<!-- AI-INSTRUCTION-SUMMARY
When implementing forms:
1. Check if DB column is NULL or NOT NULL
2. NULL columns → use nullable*() helpers
3. NOT NULL columns → use required*() helpers
4. NOT NULL + DEFAULT → use .optional() 
5. All type coercion happens in Zod, not RHF
6. PATCH: omit = no change, null = clear
-->

# Database-First Validation & Form Handling Guide

> **The database is the source of truth.**  
> Every layer—ORM, API, validation, UI—must align with database semantics.

---

## Quick Reference

### Decision Flowchart

```
                        ┌──────────────────────────┐
                        │   Can user skip field?   │
                        └────────────┬─────────────┘
                               ┌─────┴─────┐
                              YES          NO
                               │           │
                   ┌───────────┴───┐       ▼
                   │  Can clear it │   ┌──────────┐
                   │    later?     │   │ NOT NULL │
                   └───────┬───────┘   │ Required │
                     ┌─────┴─────┐     └──────────┘
                    YES          NO
                     │           │
                     ▼           ▼
               ┌───────────┐  ┌─────────────┐
               │   NULL    │  │  NOT NULL   │
               │ Clearable │  │ + DEFAULT   │
               └───────────┘  └─────────────┘
```

### Translation Table

| Business Says | DB | Prisma | Zod (Create) | Zod (Update) | Form Empty → |
|---------------|----|--------|--------------|--------------|--------------|
| "Required" | `NOT NULL` | `String` | `requiredString()` | `.optional()` | ❌ Reject |
| "Optional, can clear" | `NULL` | `String?` | `nullableString()` | `.optional()` | `null` |
| "Optional, has default" | `NOT NULL DEFAULT x` | `@default("x")` | `.optional()` | `.optional()` | Omit |
| "Must select one" | `INT NOT NULL FK` | `Int` | `requiredId()` | `.optional()` | ❌ Reject |
| "Optional selection" | `INT NULL FK` | `Int?` | `nullableId()` | `.optional()` | `null` |
| "Yes/No toggle" | `BIT NOT NULL DEFAULT 0` | `@default(false)` | `z.boolean()` | `.optional()` | `false` |
| "Yes/No/Unanswered" | `BIT NULL` | `Boolean?` | `nullableBoolean()` | `.optional()` | `null` |

### PATCH Semantics

| Payload | Meaning | Prisma Behavior |
|---------|---------|-----------------|
| Field omitted | No change | `undefined` → field skipped |
| `{ field: "value" }` | Set value | Updates column |
| `{ field: null }` | Clear value | Sets column to `NULL` |

---

## Full Stack Example

A single `User` model demonstrating all common patterns.

### Database (SQL Server)

```sql
CREATE TABLE Users (
    -- Required fields
    id            INT IDENTITY(1,1) PRIMARY KEY,
    email         NVARCHAR(255) NOT NULL,
    first_name    NVARCHAR(100) NOT NULL,
    
    -- Nullable/clearable fields  
    middle_name   NVARCHAR(100) NULL,
    bio           NVARCHAR(500) NULL,
    
    -- Required foreign key (must select)
    eye_color_id  INT NOT NULL REFERENCES EyeColors(id),
    
    -- Nullable foreign key (optional select)
    hair_color_id INT NULL REFERENCES HairColors(id),
    
    -- Optional with system default
    display_name  NVARCHAR(100) NOT NULL DEFAULT 'New User',
    
    -- Boolean with default
    is_active     BIT NOT NULL DEFAULT 1,
    
    -- Nullable boolean (three-state)
    agreed_to_terms BIT NULL,
    
    -- System-managed (never in forms)
    created_at    DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at    DATETIME2 NOT NULL DEFAULT GETDATE()
);
```

### Prisma Schema

```prisma
model User {
  // Required
  id          Int      @id @default(autoincrement())
  email       String
  firstName   String   @map("first_name")
  
  // Nullable/clearable
  middleName  String?  @map("middle_name")
  bio         String?
  
  // Required FK
  eyeColorId  Int      @map("eye_color_id")
  eyeColor    EyeColor @relation(fields: [eyeColorId], references: [id])
  
  // Nullable FK
  hairColorId Int?     @map("hair_color_id")
  hairColor   HairColor? @relation(fields: [hairColorId], references: [id])
  
  // Optional with default
  displayName String   @default("New User") @map("display_name")
  
  // Boolean with default
  isActive    Boolean  @default(true) @map("is_active")
  
  // Nullable boolean (three-state)
  agreedToTerms Boolean? @map("agreed_to_terms")
  
  // System-managed
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  @@map("Users")
}
```

### Zod Schema

```typescript
// src/schemas/helpers.ts
import { z } from "zod";

/** Required non-empty string */
export const requiredString = (error = "Required") =>
  z.string().min(1, { error });

/** Nullable string - empty string becomes null */
export const nullableString = (maxLength?: number) => {
  let schema = z.string();
  if (maxLength) schema = schema.max(maxLength);
  return schema.transform((val) => (val === "" ? null : val)).nullable();
};

/** Required foreign key ID - handles string from form, rejects empty */
export const requiredId = (error = "Required") =>
  z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number({ error }).int().positive()
  );

/** Nullable foreign key ID - empty/invalid becomes null */
export const nullableId = () =>
  z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    },
    z.number().int().positive().nullable()
  );

/** Boolean with default */
export const booleanWithDefault = (defaultValue = false) =>
  z.boolean().default(defaultValue);

/** Nullable boolean (three-state: true/false/null) */
export const nullableBoolean = () =>
  z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return null;
  }, z.boolean().nullable());
```

```typescript
// src/schemas/user.ts
import { z } from "zod";
import {
  requiredString,
  nullableString,
  requiredId,
  nullableId,
  booleanWithDefault,
  nullableBoolean,
} from "./helpers";

const userFields = {
  // Required - empty rejected
  email: z.email({ error: "Invalid email" }),
  firstName: requiredString("First name is required"),

  // Nullable - empty becomes null
  middleName: nullableString(100),
  bio: nullableString(500),

  // Required FK - must select
  eyeColorId: requiredId("Please select an eye color"),

  // Nullable FK - optional select
  hairColorId: nullableId(),

  // Optional with default - omit to use DB default
  displayName: z.string().max(100).optional(),

  // Boolean - defaults to true if omitted
  isActive: booleanWithDefault(true),

  // Nullable boolean - three-state (Yes/No/Unanswered)
  agreedToTerms: nullableBoolean(),
};

// Create: all fields as defined
export const userCreateSchema = z.object(userFields);

// Update: all fields optional (omission = no change)
export const userUpdateSchema = z.object(userFields).partial();

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
```

### Server Actions

```typescript
// src/lib/actions/user.ts
"use server";

import { prisma } from "~/lib/db";
import { userCreateSchema, userUpdateSchema } from "~/schemas/user";

export async function createUser(data: unknown) {
  // Zod handles all coercion (string → number, empty → null, etc.)
  const result = userCreateSchema.safeParse(data);

  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  const user = await prisma.user.create({ data: result.data });
  return { data: user };
}

export async function updateUser(id: number, data: unknown) {
  const result = userUpdateSchema.safeParse(data);

  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  // Prisma skips undefined fields, sets null for null values
  const user = await prisma.user.update({
    where: { id },
    data: result.data,
  });

  return { data: user };
}
```

### Form Component

```tsx
// src/components/UserForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { userCreateSchema, type UserCreateInput } from "~/schemas/user";
import { createUser } from "~/lib/actions/user";

interface Props {
  eyeColors: { id: number; name: string }[];
  hairColors: { id: number; name: string }[];
}

export function UserForm({ eyeColors, hairColors }: Props) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
  });

  function onSubmit(data: UserCreateInput) {
    startTransition(async () => {
      const result = await createUser(data);
      if (result.error) {
        Object.entries(result.error).forEach(([field, messages]) => {
          form.setError(field as keyof UserCreateInput, {
            message: messages?.[0],
          });
        });
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Required string */}
      <div>
        <label>Email *</label>
        <input type="email" {...form.register("email")} />
        {form.formState.errors.email && (
          <span>{form.formState.errors.email.message}</span>
        )}
      </div>

      {/* Required string */}
      <div>
        <label>First Name *</label>
        <input {...form.register("firstName")} />
        {form.formState.errors.firstName && (
          <span>{form.formState.errors.firstName.message}</span>
        )}
      </div>

      {/* Nullable string - empty becomes null via Zod transform */}
      <div>
        <label>Middle Name</label>
        <input {...form.register("middleName")} />
      </div>

      {/* Nullable string with max length */}
      <div>
        <label>Bio</label>
        <textarea {...form.register("bio")} maxLength={500} />
      </div>

      {/* Required FK - Zod preprocess handles string → number */}
      <div>
        <label>Eye Color *</label>
        <select {...form.register("eyeColorId")} defaultValue="">
          <option value="" disabled>
            Select eye color
          </option>
          {eyeColors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {form.formState.errors.eyeColorId && (
          <span>{form.formState.errors.eyeColorId.message}</span>
        )}
      </div>

      {/* Nullable FK - Zod preprocess handles string → number | null */}
      <div>
        <label>Hair Color</label>
        <select {...form.register("hairColorId")} defaultValue="">
          <option value="">None</option>
          {hairColors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Optional with DB default - leave empty to use default */}
      <div>
        <label>Display Name</label>
        <input {...form.register("displayName")} placeholder="New User" />
        <small>Leave empty to use default</small>
      </div>

      {/* Boolean with default */}
      <div>
        <label>
          <input type="checkbox" {...form.register("isActive")} />
          Active
        </label>
      </div>

      {/* Nullable boolean - three-state with radio buttons */}
      <div>
        <label>Agreed to Terms</label>
        <div>
          <label>
            <input
              type="radio"
              {...form.register("agreedToTerms")}
              value="true"
            />
            Yes
          </label>
          <label>
            <input
              type="radio"
              {...form.register("agreedToTerms")}
              value="false"
            />
            No
          </label>
          <label>
            <input
              type="radio"
              {...form.register("agreedToTerms")}
              value=""
            />
            Not specified
          </label>
        </div>
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Create User"}
      </button>
    </form>
  );
}
```

---

## Pattern Details

<details>
<summary><strong>Required String</strong> — "User must answer"</summary>

### Fields
`email`, `firstName`, `lastName`, `password`

### Stack
```sql
first_name NVARCHAR(100) NOT NULL
```
```prisma
firstName String
```
```typescript
firstName: z.string().min(1, { error: "Required" })
```

### Behavior
| User enters | Zod result | DB |
|-------------|------------|-----|
| `"John"` | ✅ `"John"` | `'John'` |
| `""` | ❌ Error | — |

</details>

<details>
<summary><strong>Nullable String</strong> — "Optional, can clear"</summary>

### Fields
`middleName`, `bio`, `notes`, `alternatePhone`

### Stack
```sql
middle_name NVARCHAR(100) NULL
```
```prisma
middleName String?
```
```typescript
middleName: z.string()
  .max(100)
  .transform(val => val === "" ? null : val)
  .nullable()
```

### Behavior
| User enters | Zod result | DB |
|-------------|------------|-----|
| `"James"` | `"James"` | `'James'` |
| `""` | `null` | `NULL` |
| *(omitted in update)* | `undefined` | *(unchanged)* |

</details>

<details>
<summary><strong>Required FK (Select)</strong> — "Must choose one"</summary>

### Fields
`eyeColorId`, `countryId`, `roleId`

### Stack
```sql
eye_color_id INT NOT NULL REFERENCES EyeColors(id)
```
```prisma
eyeColorId Int
eyeColor   EyeColor @relation(fields: [eyeColorId], references: [id])
```
```typescript
eyeColorId: z.preprocess(
  (val) => (val === "" || val === undefined ? undefined : Number(val)),
  z.number({ error: "Required" }).int().positive()
)
```

### Form
```tsx
<select {...register("eyeColorId")} defaultValue="">
  <option value="" disabled>Select...</option>
  {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
</select>
```

### Behavior
| User selects | Zod result | DB |
|--------------|------------|-----|
| Option with value `3` | ✅ `3` | `3` |
| Nothing (empty string) | ❌ Error | — |

</details>

<details>
<summary><strong>Nullable FK (Select)</strong> — "Optional selection"</summary>

### Fields
`secondaryColorId`, `referredById`, `managerId`

### Stack
```sql
hair_color_id INT NULL REFERENCES HairColors(id)
```
```prisma
hairColorId Int?
```
```typescript
hairColorId: z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  },
  z.number().int().positive().nullable()
)
```

### Form
```tsx
<select {...register("hairColorId")} defaultValue="">
  <option value="">None</option>
  {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
</select>
```

### Behavior
| User selects | Zod result | DB |
|--------------|------------|-----|
| Option with value `3` | `3` | `3` |
| "None" (empty string) | `null` | `NULL` |

</details>

<details>
<summary><strong>Boolean with Default</strong> — "Yes/No toggle"</summary>

### Fields
`isActive`, `receiveNewsletter`

### Stack
```sql
is_active BIT NOT NULL DEFAULT 1
```
```prisma
isActive Boolean @default(true)
```
```typescript
isActive: z.boolean().default(true)
```

### Form
```tsx
<input type="checkbox" {...register("isActive")} />
```

### Behavior
| User action | Zod result | DB |
|-------------|------------|-----|
| Checked | `true` | `1` |
| Unchecked | `false` | `0` |

</details>

<details>
<summary><strong>Nullable Boolean</strong> — "Yes/No/Unanswered"</summary>

### Fields
`agreedToTerms`, `hasInsurance`, `isVerified`

### Use Case
Three-state logic where "unanswered" is distinct from "no":
- `null` = User hasn't answered yet
- `false` = Explicitly "No"
- `true` = Explicitly "Yes"

### Stack
```sql
agreed_to_terms BIT NULL
```
```prisma
agreedToTerms Boolean?
```
```typescript
agreedToTerms: z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return null;
  if (val === "true" || val === true) return true;
  if (val === "false" || val === false) return false;
  return null;
}, z.boolean().nullable())
```

### Form — Use Radio Buttons (not checkbox)
```tsx
<div>
  <label>
    <input type="radio" {...register("agreedToTerms")} value="true" />
    Yes
  </label>
  <label>
    <input type="radio" {...register("agreedToTerms")} value="false" />
    No
  </label>
  <label>
    <input type="radio" {...register("agreedToTerms")} value="" />
    Not specified
  </label>
</div>
```

### Behavior
| User selects | Zod result | DB |
|--------------|------------|-----|
| "Yes" | `true` | `1` |
| "No" | `false` | `0` |
| "Not specified" | `null` | `NULL` |

</details>

<details>
<summary><strong>Optional with Default</strong> — "System fills if empty"</summary>

### Fields
`displayName`, `username`, `status`

### Stack
```sql
display_name NVARCHAR(100) NOT NULL DEFAULT 'New User'
```
```prisma
displayName String @default("New User")
```
```typescript
displayName: z.string().max(100).optional()
```

### Form
```tsx
<input {...register("displayName")} placeholder="New User" />
```

### Behavior
| User enters | Zod result | DB |
|-------------|------------|-----|
| `"Alice"` | `"Alice"` | `'Alice'` |
| `""` or omitted | `undefined` | `'New User'` (default) |

### Notes
- Use `optional()`, NOT `nullable()`
- Empty/omitted → Prisma skips → DB applies default

</details>

---

## Anti-Patterns

| ❌ Don't | ✅ Do | Why |
|----------|-------|-----|
| Store `""` in DB | Store `NULL` | Empty string is ambiguous |
| `z.string().optional()` for clearable | `nullableString()` with transform | Empty → null, not "" |
| RHF `valueAsNumber` / `setValueAs` | Zod `preprocess` | Single source of truth |
| Convert types in server action | Zod handles coercion | Schema is the contract |
| Checkbox for three-state boolean | Radio buttons | Checkbox can't represent null |
| `required` on nullable DB columns | Allow null, transform empty | Align with DB |

---

## Mental Models

> **JSON has no undefined.** Omit the field for "no change", send null for "clear".

> **Empty string ≠ null.** Browser sends `""`, Zod transforms to `null`.

> **Zod is the data contract.** All coercion (string→number, empty→null) happens in Zod, not RHF or server action.

> **Prisma skips undefined.** Pass validated object directly, undefined fields are ignored.

> **optional ≠ nullable:**
> - `optional()` = field may be missing → Prisma skips
> - `nullable()` = value may be null → Prisma sets NULL
> - Both = PATCH-safe and clearable

> **Database decides.** NULL column? Use `nullableX()`. NOT NULL? Use `requiredX()`.

> **Three states need three options.** Checkbox = 2 states. Radio buttons = 3+ states.
