# Phase J: Scheduled Actions — Implementation Plan ✅ COMPLETE

## Overview

Add the ability to schedule future-dated actions (transfer, send to reassignment, send to lost list, deactivate, merge group) via a `ScheduledAction` model, a Vercel Cron job, and a required effective date picker on all 5 action dialogs. Today's date = immediate execution (unchanged behavior); future date = pending scheduled action executed by cron.

**Status:** All 9 steps implemented. Code review fixes applied (deactivate conflict check bug, cron revalidation, Execute Now admin tracking).

---

## Step 1: ScheduledAction model + migration

**Goal**: Add schema, run migration. The new model is unused at this point — codebase stays functional.

**Modify**: `packages/database/prisma/schema.prisma`

Add two enums (after `AdjustmentType`, before `SmsStatus`):

```prisma
enum ScheduledActionType {
  TRANSFER
  SEND_TO_REASSIGNMENT
  SEND_TO_LOST
  DEACTIVATE
  MERGE_GROUP
}

enum ScheduledActionStatus {
  PENDING
  COMPLETED
  FAILED
  CANCELLED
}
```

Add model (after `Exam`, end of schema):

```prisma
model ScheduledAction {
  id            String                @id @default(cuid())
  type          ScheduledActionType
  status        ScheduledActionStatus @default(PENDING)
  effectiveDate DateTime              @db.Date

  studentId    String?
  membershipId String?

  sourceGroupId String?
  destGroupId   String?

  payload Json

  createdById   String
  createdAt     DateTime  @default(now())
  executedAt    DateTime?
  cancelledAt   DateTime?
  cancelReason  String?
  failureReason String?

  student     Student?         @relation(fields: [studentId], references: [id], onDelete: Restrict)
  membership  GroupMembership? @relation(fields: [membershipId], references: [id], onDelete: Restrict)
  sourceGroup Group?           @relation("ScheduledActionSource", fields: [sourceGroupId], references: [id], onDelete: Restrict)
  destGroup   Group?           @relation("ScheduledActionDest", fields: [destGroupId], references: [id], onDelete: Restrict)
  createdBy   AdminUser        @relation("ScheduledActionCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)

  @@index([status, effectiveDate])
  @@index([studentId, status])
  @@index([membershipId, status])
  @@index([sourceGroupId, status])
}
```

Add reverse relations on existing models:
- `AdminUser`: `scheduledActions ScheduledAction[] @relation("ScheduledActionCreatedBy")`
- `Student`: `scheduledActions ScheduledAction[]`
- `GroupMembership`: `scheduledActions ScheduledAction[]`
- `Group`: `scheduledActionsAsSource ScheduledAction[] @relation("ScheduledActionSource")` and `scheduledActionsAsDest ScheduledAction[] @relation("ScheduledActionDest")`

**Run**: `cd packages/database && npx prisma migrate dev --name add_scheduled_action_model`

**Verify**: `npx prisma generate` succeeds, app starts, new table exists.

---

## Step 2: `getUzbekistanToday()` helper

**Goal**: Timezone-aware "today" helper. Small, isolated.

**Modify**: `apps/admin/src/lib/helpers/date.ts`

```ts
/**
 * Get today's date in Uzbekistan timezone (Asia/Tashkent, UTC+5).
 * Returns a Date set to midnight UTC representing today in Tashkent.
 *
 * Prevents mismatch where 1 AM Tashkent = 20:00 UTC previous day.
 */
export function getUzbekistanToday(): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" });
  const todayStr = formatter.format(new Date()); // "YYYY-MM-DD" in Tashkent
  return new Date(todayStr + "T00:00:00Z");
}
```

Also export a client-safe version for the date picker `min` attribute:

```ts
export function getUzbekistanTodayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}
```

---

## Step 3: Extract core logic from the 5 actions

**Goal**: Move business logic (validation, transaction, DB queries) into standalone helper functions. Server actions become thin wrappers (auth + parse + call helper + revalidate). Pure refactor — identical behavior.

### Shared helper for uncertain logic

**Create**: `apps/admin/src/lib/helpers/uncertain.ts`

Move `UNCERTAIN_CLEAR_FIELDS` constant and `resolveUncertainHistory()` function from `actions/students.ts` into this file. Both `sendToReassignment` and `sendToLostList` use them, and the new execute helpers will need them too.

### 3a: Transfer

**Create**: `apps/admin/src/lib/helpers/execute-transfer.ts`

```ts
export interface ExecuteTransferParams {
  membershipId: string;
  destinationGroupId: string;
  transferReasonId: string;
  otherTransferReason: string | null;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteTransferResult {
  success: true;
  transferCredit: number;
  refundAmount: number;
  warning?: string;
  revalidatePaths: string[];
}

export async function executeTransfer(
  params: ExecuteTransferParams,
): Promise<{ error: string } | ExecuteTransferResult>
```

Extract from `transferStudent()` in `actions/transfers.ts` (lines 37–292):
- All `today` references → `params.effectiveDate`
- No `requireAdmin()`, no `revalidatePath`
- Returns `revalidatePaths: string[]` so the wrapper can revalidate

**Modify**: `apps/admin/src/lib/actions/transfers.ts`

```ts
export async function transferStudent(data: unknown) {
  const admin = await requireAdmin();
  const parsed = transferStudentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" };

  const effectiveDate = getUzbekistanToday();
  const result = await executeTransfer({ ...parsed.data, adminId: admin.id, effectiveDate });
  if ("error" in result) return result;

  for (const path of result.revalidatePaths) revalidatePath(path);
  return {
    success: result.success,
    transferCredit: result.transferCredit,
    refundAmount: result.refundAmount,
    ...(result.warning && { warning: result.warning }),
  };
}
```

### 3b: Send to Reassignment

**Create**: `apps/admin/src/lib/helpers/execute-reassignment.ts`

```ts
export interface ExecuteReassignmentParams {
  studentId: string;
  membershipId?: string;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteReassignmentResult {
  success: true;
  revalidatePaths: string[];
}

export async function executeReassignment(
  params: ExecuteReassignmentParams,
): Promise<{ error: string } | ExecuteReassignmentResult>
```

Extract from `sendToReassignment()` in `actions/students.ts`. Import uncertain helpers from `helpers/uncertain.ts`.

### 3c: Send to Lost

**Create**: `apps/admin/src/lib/helpers/execute-send-to-lost.ts`

```ts
export interface ExecuteSendToLostParams {
  studentId: string;
  membershipId: string;
  lostReasonId: string;
  otherLostReason: string | null;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteSendToLostResult {
  success: true;
  revalidatePaths: string[];
}

export async function executeSendToLost(
  params: ExecuteSendToLostParams,
): Promise<{ error: string } | ExecuteSendToLostResult>
```

Extract from `sendToLostList()` in `actions/students.ts`.

### 3d: Deactivate

**Create**: `apps/admin/src/lib/helpers/execute-deactivate.ts`

```ts
export interface ExecuteDeactivateParams {
  studentId: string;
  lostReasonId: string;
  otherLostReason: string | null;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteDeactivateResult {
  success: true;
  revalidatePaths: string[];
}

export async function executeDeactivate(
  params: ExecuteDeactivateParams,
): Promise<{ error: string } | ExecuteDeactivateResult>
```

Extract from `deactivateStudent()` in `actions/students.ts`.

### 3e: Merge

**Create**: `apps/admin/src/lib/helpers/execute-merge.ts`

```ts
export interface ExecuteMergeParams {
  sourceGroupId: string;
  destinationGroupId: string;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteMergeResult {
  success: true;
  movedCount: number;
  warning?: string;
  revalidatePaths: string[];
}

export async function executeMerge(
  params: ExecuteMergeParams,
): Promise<{ error: string } | ExecuteMergeResult>
```

Extract from `mergeGroup()` in `actions/group-merge.ts`.

**Modify**: `apps/admin/src/lib/actions/group-merge.ts` — thin wrapper.

### Files summary for Step 3

**Create (6 files)**:
- `apps/admin/src/lib/helpers/uncertain.ts`
- `apps/admin/src/lib/helpers/execute-transfer.ts`
- `apps/admin/src/lib/helpers/execute-reassignment.ts`
- `apps/admin/src/lib/helpers/execute-send-to-lost.ts`
- `apps/admin/src/lib/helpers/execute-deactivate.ts`
- `apps/admin/src/lib/helpers/execute-merge.ts`

**Modify (3 files)**:
- `apps/admin/src/lib/actions/transfers.ts`
- `apps/admin/src/lib/actions/students.ts`
- `apps/admin/src/lib/actions/group-merge.ts`

**Verify**: All 5 actions work identically through the UI. Run integration tests.

---

## Step 4: Conflict detection helper

**Goal**: Functions that check whether an action is blocked by a pending scheduled action.

**Create**: `apps/admin/src/lib/helpers/scheduled-action-conflicts.ts`

```ts
/**
 * Block immediate student action (transfer/reassign/lost) if same membership
 * has a pending scheduled action. Returns error message or null.
 */
export async function checkImmediateStudentActionConflict(
  membershipId: string,
): Promise<string | null>

/**
 * Block immediate deactivate if student has ANY pending scheduled action.
 * Returns error message or null.
 */
export async function checkImmediateDeactivateConflict(
  studentId: string,
): Promise<string | null>

/**
 * Block immediate merge if:
 * - Source group already has a pending scheduled merge, OR
 * - Any students in source group have pending scheduled actions
 * Returns error message or null.
 */
export async function checkImmediateMergeConflict(
  sourceGroupId: string,
): Promise<string | null>

/**
 * Block creating a new scheduled action if:
 * - Same membership already has one (student-level actions)
 * - Same source group already has a scheduled merge
 * Returns error message or null.
 */
export async function checkScheduledActionConflict(
  type: ScheduledActionType,
  membershipId?: string,
  sourceGroupId?: string,
): Promise<string | null>
```

Each queries `ScheduledAction WHERE status = 'PENDING'` with appropriate filters. Returns human-readable error messages referencing the conflicting action's type and effective date.

---

## Step 5: Wire conflict checks into immediate actions

**Goal**: Each server action checks for conflicts before executing.

**Modify**: `apps/admin/src/lib/actions/transfers.ts`
```ts
// After parsing, before executeTransfer:
const conflict = await checkImmediateStudentActionConflict(parsed.data.membershipId);
if (conflict) return { error: conflict };
```

**Modify**: `apps/admin/src/lib/actions/students.ts`
- `sendToReassignment`: check `checkImmediateStudentActionConflict(membershipId)` when membershipId is provided
- `sendToLostList`: check `checkImmediateStudentActionConflict(membershipId)`
- `deactivateStudent`: check `checkImmediateDeactivateConflict(studentId)`

**Modify**: `apps/admin/src/lib/actions/group-merge.ts`
```ts
const conflict = await checkImmediateMergeConflict(parsed.data.sourceGroupId);
if (conflict) return { error: conflict };
```

**Verify**: With no pending scheduled actions, all actions work. Insert a PENDING scheduled action manually → verify blocking.

---

## Step 6: Scheduled action CRUD + executor helper

**Goal**: Server actions for creating, cancelling, and executing scheduled actions. Plus a shared executor used by both "Execute Now" and the cron handler.

### Schemas

**Create**: `apps/admin/src/schemas/scheduled-action.ts`

```ts
export const createScheduledActionSchema = z.object({
  type: z.enum(["TRANSFER", "SEND_TO_REASSIGNMENT", "SEND_TO_LOST", "DEACTIVATE", "MERGE_GROUP"]),
  effectiveDate: requiredIsoDate("Effective date is required"),
  studentId: z.string().optional(),
  membershipId: z.string().optional(),
  sourceGroupId: z.string().optional(),
  destinationGroupId: z.string().optional(),
  payload: z.record(z.unknown()),
});

export const cancelScheduledActionSchema = z.object({
  id: requiredString("Action ID is required"),
  cancelReason: z.string().nullable().optional(),
});
```

### Shared executor

**Create**: `apps/admin/src/lib/helpers/execute-scheduled-action.ts`

```ts
/**
 * Execute a single scheduled action by dispatching to the appropriate core logic.
 * Used by both the cron handler and "Execute Now" server action.
 */
export async function executeSingleScheduledAction(
  action: ScheduledAction,
  adminIdOverride?: string,
): Promise<{ success: true } | { error: string }>
```

This function:
1. Switches on `action.type`
2. Deserializes `action.payload` into typed params
3. Calls the appropriate `executeTransfer` / `executeReassignment` / etc. with `action.effectiveDate`
4. On success: marks `COMPLETED`, sets `executedAt`
5. On `{ error }` return: marks `FAILED`, sets `failureReason`

### Server actions

**Create**: `apps/admin/src/lib/actions/scheduled-actions.ts`

```ts
"use server";

export async function createScheduledAction(data: unknown)
// Validates effectiveDate > uzbekistanToday, runs checkScheduledActionConflict, creates PENDING record

export async function cancelScheduledAction(data: unknown)
// Finds action, verifies PENDING, sets CANCELLED + cancelledAt + cancelReason

export async function executeScheduledActionNow(id: string)
// Finds action, verifies PENDING, calls executeSingleScheduledAction, revalidates
```

---

## Step 7: Vercel Cron setup + route handler

**Goal**: Daily cron at 00:00 UTC executes pending scheduled actions.

**Create**: `apps/admin/vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/execute-scheduled-actions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Create**: `apps/admin/src/app/api/cron/execute-scheduled-actions/route.ts`

```ts
export async function GET(request: Request) {
  // 1. Verify CRON_SECRET
  // 2. const today = getUzbekistanToday()
  // 3. Query PENDING actions WHERE effectiveDate <= today, ORDER BY effectiveDate ASC
  // 4. For each action:
  //    - Race condition safety: updateMany WHERE id AND status = PENDING (claim it)
  //    - Call executeSingleScheduledAction(action)
  //    - Catch unexpected throws, mark FAILED
  // 5. Return JSON summary { processed, results }
}
```

**Environment**: Add `CRON_SECRET` to Vercel project env vars.

**Verify**: Hit endpoint without auth → 401. With auth → processes pending actions.

---

## Step 8: Required date picker on all 5 action dialogs

**Goal**: Every action dialog gets a required "Effective date" field. Today = immediate, future = scheduled.

### Reusable component

**Create**: `apps/admin/src/components/shared/effective-date-picker.tsx`

Simple wrapper around `<input type="date">` with Label, required, and `min` set to today (Tashkent). Client-side `getUzbekistanTodayStr()` for the min value.

### Schema updates (add effectiveDate to existing schemas)

- `apps/admin/src/schemas/transfer.ts`: add `effectiveDate: requiredIsoDate("Effective date is required")`
- `apps/admin/src/schemas/student.ts` (`deactivateStudentSchema`): add `effectiveDate`
- Reassignment/lost schemas: add `effectiveDate` field (either to existing schemas or as new schemas)
- Merge schema: add `effectiveDate`

### Server action routing logic (add to all 5 actions)

After parsing, each action does:

```ts
const effectiveDate = new Date(parsed.data.effectiveDate + "T00:00:00Z");
const today = getUzbekistanToday();

if (effectiveDate.getTime() === today.getTime()) {
  // Immediate — call executeXxx(), revalidate, return
} else if (effectiveDate > today) {
  // Scheduled — run checkScheduledActionConflict(), create ScheduledAction, return { success, scheduled: true }
} else {
  return { error: "Effective date cannot be in the past" };
}
```

### Dialog updates

**Modify** (add `EffectiveDatePicker` + routing logic):
- `apps/admin/src/components/transfers/transfer-dialog.tsx`
  - Add `effectiveDate` state, add picker, require it for submit
  - When future date: hide billing preview, show "Billing will be calculated on the effective date"
  - Handle `{ scheduled: true }` response → different toast
- `apps/admin/src/components/groups/student-list.tsx` (`MemberActionsMenu`)
  - Reassignment inline dialog: add date picker
  - Lost list inline dialog: add date picker
- `apps/admin/src/components/groups/student-list.tsx` (`TrialActionsMenu`)
  - Same for trial student actions that call reassignment/lost
- `apps/admin/src/components/students/student-actions.tsx`
  - Deactivate dialog: add date picker
- `apps/admin/src/components/groups/merge-group-section.tsx` / `merge-dialog.tsx`
  - Merge dialog: add date picker
  - When future date: hide billing preview

### Verify

- Every dialog: date is required, no default, min=today
- Today → immediate execution, same as before
- Future → toast "Scheduled for {date}", action appears in scheduled actions list
- Transfer/merge: billing preview hidden for future dates
- Past dates rejected by HTML `min` + server validation

---

## Step 9: Scheduled Actions page + sidebar

**Goal**: `/scheduled-actions` page with data table, status filters, Cancel/Execute Now buttons.

### Query

**Create**: `apps/admin/src/lib/queries/scheduled-actions.ts`

- `getScheduledActions(status?)` — with student, group, createdBy includes
- `getScheduledActionCount()` — count of PENDING, for sidebar badge

### Page

**Create**: `apps/admin/src/app/(admin)/scheduled-actions/page.tsx`

Server component, fetches all scheduled actions, renders `ScheduledActionsTable`.

### Table

**Create**: `apps/admin/src/components/scheduled-actions/scheduled-actions-table.tsx`

Client component with:
- Status filter tabs: All / Pending / Completed / Failed / Cancelled
- Columns: Type, Student/Group (linked), Source Group, Destination, Effective Date, Status badge, Created By, Created At, Failure Reason
- PENDING row actions: Cancel (confirmation + optional reason), Execute Now (confirmation)
- Status badges: PENDING=amber, COMPLETED=green, FAILED=red, CANCELLED=gray

### Sidebar

**Modify**: `apps/admin/src/components/app-sidebar.tsx`
- Add `{ label: "Scheduled", href: "/scheduled-actions", icon: Clock }` to Daily Workflow section
- Add badge config for pending count

**Modify**: `apps/admin/src/app/(admin)/layout.tsx`
- Add `getScheduledActionCount()` to `Promise.all`
- Pass `scheduledCount` to `AppSidebar`

---

## Implementation Sequence

```
Step 1 (schema)  ─┬─→ Step 3 (extract logic) ─→ Step 5 (wire conflicts) ─→ Step 8 (date pickers)
                  │
Step 2 (timezone) ┘    Step 4 (conflict helper) ┘   Step 6 (CRUD) ────────→ Step 7 (cron)
                                                                            ↓
                                                                       Step 9 (UI page)
```

Steps 1+2 first (parallel). Step 3 next (biggest risk). Steps 4+5 follow. Steps 6+7+8+9 build on that foundation.

---

## Risk summary

| Risk | Mitigation |
|------|-----------|
| Step 3 breaks existing actions | Pure refactor — same inputs/outputs. Test each action through UI after extraction. |
| Timezone mismatch | `getUzbekistanToday()` used consistently in cron + immediate/scheduled decision. |
| Cron race conditions | `updateMany WHERE status = PENDING` claims action atomically. |
| Stale scheduled actions | Core logic validates preconditions at execution time — marks FAILED if state changed. |
| Payload type safety | Discriminated union types + runtime validation in `executeSingleScheduledAction`. |
