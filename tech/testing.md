# Integration Testing Guide

How automated integration tests work in the admin panel. Tests call real server actions against a real (isolated) database — no browser, no mocking of business logic.

---

## Quick Start

```bash
cd apps/admin
npm run test:integration
```

That's it. No flags, no env switching, no manual setup.

## How It Works

### Architecture

```
vitest.config.integration.ts
  ├── loads .env.test            → sets DATABASE_URL to Neon test branch
  ├── runs setup.ts (before all) → mocks auth, next/cache, next/navigation
  └── runs scenarios/*.test.ts   → tests call real server actions
```

Tests import and call server actions directly (e.g., `createStudent(data)`). The server action code runs **unchanged** — Prisma hits the test DB, `requireAdmin()` returns a mock admin, `redirect()` throws a catchable error.

### What's Real vs Mocked

| Component | Real or Mocked? | Why |
|-----------|----------------|-----|
| Server action code | **Real** | That's what we're testing |
| Prisma / DB queries | **Real** (test branch) | Validates actual SQL, constraints, transactions |
| Business logic helpers | **Real** | Part of the action pipeline |
| Zod validation | **Real** | Tests should catch schema issues |
| `requireAdmin()` | **Mocked** | No NextAuth/Google OAuth in tests |
| `redirect()` | **Mocked** | Throws `RedirectError` — tests assert the URL |
| `revalidatePath()` | **Mocked** | Next.js cache concept, no-op in tests |

### Database Isolation

| Command | Database |
|---------|----------|
| `npm run dev` | Neon **main** branch (production) — via `.env` |
| `npm run test:integration` | Neon **test** branch (isolated) — via `.env.test` |

No manual switching. The vitest config reads `.env.test` and sets `process.env.DATABASE_URL` before Prisma initializes. The same singleton Prisma client is used — it just connects to a different branch.

The test branch has **schema only** (tables, indexes, constraints, triggers) — no rows. Tests seed their own data.

---

## File Structure

```
apps/admin/
├── .env.test                              # Test branch DATABASE_URL
├── vitest.config.integration.ts           # Separate vitest config for integration tests
└── src/__tests__/
    ├── helpers/
    │   ├── constants.ts                   # TEST_ADMIN_ID, TEST_ADMIN object
    │   ├── setup.ts                       # vi.mock() for auth, next/cache, next/navigation
    │   ├── db.ts                          # truncateAll, cleanupTestData, seedEssentials, disconnect
    │   └── factories.ts                   # createTestTeacher, createTestStudent, etc.
    └── scenarios/
        ├── smoke.test.ts                  # Infrastructure verification
        └── (future scenario test files)
```

### Key Files Explained

**`vitest.config.integration.ts`** — Separate from the main `vitest.config.ts` (which runs unit tests like schema-helpers). Loads `.env.test`, sets 30s test timeout, disables parallel execution (shared DB state).

**`setup.ts`** — Vitest runs this before any test file. Sets up three `vi.mock()` calls:
- `@/lib/auth` — `requireAdmin()` / `requireRole()` return a test admin with a known ID
- `next/cache` — `revalidatePath()` is a no-op
- `next/navigation` — `redirect(url)` throws `RedirectError` (catchable in tests)

**`db.ts`** — Database lifecycle utilities:
- `truncateAll()` — wipes all tables, resets autoincrement sequences
- `cleanupTestData()` — wipes test data only, keeps seed data (holidays, prices, promotions, reasons, admin)
- `seedEssentials()` — inserts the minimum reference data that server actions depend on
- `disconnect()` — closes the Prisma connection

**`factories.ts`** — Create real DB records with sensible defaults:
- `createTestTeacher(overrides?)` — teacher + rate history entry
- `createTestStudent(overrides?)` — student (default: AWAITING_ASSIGNMENT)
- `createTestFamily(overrides?)` — family record
- `createTestGroup(overrides?)` — group + lessons + schedule slots + teacher history
- `createTestMembership(overrides)` — bare membership (no billing)
- `expectRedirect(fn)` — runs fn, catches RedirectError, returns the URL

---

## Writing Tests

### Test File Template

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, truncateAll, seedEssentials, cleanupTestData, disconnect } from "../helpers/db";
import { createTestTeacher, createTestStudent, createTestGroup, expectRedirect } from "../helpers/factories";

beforeAll(async () => {
  await truncateAll();
  await seedEssentials();
}, 60_000);

afterAll(async () => {
  await truncateAll();
  await disconnect();
});

describe("my scenario", () => {
  it("does something", async () => {
    // 1. Set up test data using factories
    const { group, teacher } = await createTestGroup();
    const student = await createTestStudent();

    // 2. Call the server action
    const { someAction } = await import("@/lib/actions/some-file");
    const result = await someAction(student.id, { /* data */ });

    // 3. Assert the result
    expect(result).toEqual({ success: true });

    // 4. Verify DB state
    const updated = await prisma.student.findUnique({ where: { id: student.id } });
    expect(updated!.status).toBe("ACTIVE");
  });
});
```

### Testing Actions That Redirect

Actions like `createStudent` call `redirect()` on success instead of returning a value. Use `expectRedirect`:

```ts
it("creates a student and redirects", async () => {
  const url = await expectRedirect(() =>
    createStudent({
      firstName: "John",
      lastName: "Doe",
      phone: "+998901234567",
      dateOfBirth: "2005-06-15",
      level: "BEGINNER",
      preferredDays: [1, 3, 5],
      preferredTimeSlots: ["14:00"],
      preferredLanguage: "ANY",
    })
  );

  expect(url).toMatch(/^\/students\//);
});
```

### Testing Actions That Return Errors

Actions return `{ error: "message" }` for validation/business rule failures:

```ts
it("rejects duplicate phone numbers", async () => {
  await createTestStudent({ phone: "+998901111111" });

  const result = await createStudent({
    firstName: "Jane",
    phone: "+998901111111",
    // ... other required fields
  });

  expect(result).toEqual({ error: "A student with this phone number already exists" });
});
```

### Using Factory Overrides

Every factory has sensible defaults. Override only what matters for your test:

```ts
// Default teacher — good enough for most tests
const teacher = await createTestTeacher();

// Teacher with specific levels
const ieltsTeacher = await createTestTeacher({ levels: ["IELTS"] });

// Group that reuses an existing teacher
const { group } = await createTestGroup({ teacherId: teacher.id, level: "INTERMEDIATE" });

// Student already assigned to a group
const student = await createTestStudent({ status: "ACTIVE" });
```

### Cleanup Strategy

- **`beforeAll` + `afterAll`**: Truncate and reseed at the suite level. Tests within a suite share data.
- **`afterEach` with `cleanupTestData()`**: Use when tests within a suite need full isolation from each other (keeps seed data, wipes students/teachers/groups/etc).

---

## Neon Test Branch

The test database is a **Neon branch** called `test`, forked from the main branch.

- **Schema**: Matches production (same migrations, same constraints, same triggers)
- **Data**: Empty — tests seed their own
- **Auto-delete**: Disabled (persistent branch)
- **Connection string**: In `apps/admin/.env.test`

### If the schema changes

After running new migrations on the main branch, the test branch needs to be updated. Options:

1. **Delete and recreate** the test branch from the Neon dashboard (simplest)
2. **Run migrations** against the test branch by temporarily pointing `DATABASE_URL` to it

The test branch connection string stays the same after recreation (same endpoint).

---

## Troubleshooting

**Tests hang or timeout** — Neon's serverless Postgres cold-starts can take a few seconds. The 30s test timeout and 60s hook timeout should cover this. If not, increase `hookTimeout` in `vitest.config.integration.ts`.

**`TRUNCATE TABLE ... does not exist`** — Schema is out of sync between main and test branches. Recreate the test branch from the Neon dashboard.

**Auth-related errors in server actions** — The `@/lib/auth` mock should prevent any real auth code from running. If a new module imports `@/auth` directly (instead of `@/lib/auth`), add it to the mock list in `setup.ts`.

**`SECURITY WARNING: SSL modes...`** — Harmless pg driver warning about SSL mode naming. Can be ignored.

---

## Test Scenarios

~80 test cases across 8 files, covering all 37 application-level constraints from `schema.prisma`. Each constraint reference (C#N) maps to the numbered comments at the top of the schema file.

### 1. `happy-path.test.ts` — Full Student Lifecycle

| Test Case | Constraints |
|-----------|------------|
| Create student → AWAITING_ASSIGNMENT, auto-generated referralCode | — |
| Create student with promo code → StudentPromotion attached | — |
| Create student with duplicate phone → error | C#1 |
| Create minor without familyId → error | C#7 |
| Assign student to group (trial) → ACTIVE, isTrial=true, no billing periods | C#3, C#2 |
| Resolve trial: commit → isTrial=false, billing periods created, TRIAL promo applied | C#2, C#32 |
| Resolve trial: didn't continue (GROUP) → leaveDate set, no billing, student INACTIVE | C#2 |
| Resolve trial: didn't continue (INDIVIDUAL) → bill attended lessons at full price, TRIAL promo | C#2 |
| Deactivate student → INACTIVE, lostReasonId set, inactivatedAt/By set | C#17 |
| Deactivate student with active membership → error | C#17 |
| Reactivate student → AWAITING_ASSIGNMENT, lost fields cleared | — |
| Send to reassignment → AWAITING_REASSIGNMENT | — |
| Reassign to new group (non-trial, 2nd group attempt) → auto-trial=false | C#2 |

### 2. `billing.test.ts` — Billing & Payments

| Test Case | Constraints |
|-----------|------------|
| Billing period pre-creation: correct totalLessons per month, pricePerLesson snapshot, amountDue | C#32, C#14 |
| First month partial period (join mid-month) → isPartialPeriod=true, reduced totalLessons | C#32 |
| Trial billing retroactivity: trial joins Jan 20, commits Feb 15 → periods start from original joinDate, not commit date | C#32 |
| Record payment → amountPaid updated, paymentStatus transitions (UNPAID→PARTIALLY_PAID→PAID) | C#16 |
| Adjust period manually → amountDue/discountAmount changed, PaymentPeriodAdjustment created, status recalculated | C#15, C#16 |
| Transfer billing: source periods reduced/deleted, transfer credit applied to destination | C#25, C#31 |
| Transfer with overpayment exceeding destination → remaining becomes Refund(PENDING) | C#31 |
| Dropout leave billing → current month reduced, future deleted, Refund(PENDING) if overpaid | C#31 |
| Process refund → COMPLETED with amountRefunded | — |
| Convert refund to credit → Payment(isTransferCredit) on target period | C#25 |
| Discount cap: stacked promotions capped at amountDue | C#36 |

### 3. `scheduling.test.ts` — Lessons, Cancellations, Teacher Changes

| Test Case | Constraints |
|-----------|------------|
| Create group → lessons + schedule slots + teacher history generated, holidays skipped | C#8, C#4 |
| Create group with teacher double-booking → error | C#4 |
| Cancel lesson → CANCELLED, slot deleted, replacement created at end, endDate bumped | C#9 |
| Cancel replacement lesson → originalLessonId propagated from chain root (A→B→C) | C#9 (critical) |
| Update group startTime → future SCHEDULED lessons + slots cascade-updated | C#13 |
| Student cancel individual lesson → replacement created, cancellationsUsed incremented | C#26 |
| Student cancel individual lesson (3rd in month) → error, limit enforced | C#26 |
| Student cancel individual lesson (<24h) → error | C#26 |
| Student cancel GROUP lesson → error (not allowed) | C#26 |
| Offline reschedule (individual) → dates swapped, slot moved, originalDate preserved, no cancellation count | C#27 |
| Teacher unavailability → affected SCHEDULED lessons become PENDING_RESOLUTION | C#28, C#20a |
| Unavailability overlap on same date → error | C#20a |
| Assign substitute → slot swapped, lesson back to SCHEDULED | C#29 |
| Permanent teacher change → Group.teacherId, all future lessons' teacherId+originalTeacherId, slots swapped, history closed/opened | C#21 |
| Complete lesson → activeStudentCount snapshot as of lessonDate | C#37 |
| Complete lesson: student leaves between lesson and marking → snapshot uses lessonDate membership count, not current | C#37 |
| Complete lesson with absent trial student → auto-remove trial, deactivate if solo | C#2, C#37 |

### 4. `group-lifecycle.test.ts` — Graduation & Merge

| Test Case | Constraints |
|-----------|------------|
| Graduate group: eligible (no SCHEDULED lessons) → next-level group created | C#23, C#24 |
| Graduate group: IELTS level → error (no next level) | C#24 |
| Graduate group: skipAutoGraduation=true → error | C#23 |
| Graduate with SCHEDULED lessons remaining → error | C#23 |
| Graduate: continuing students get new membership + billing, Student.level updated | C#23, C#32, C#33 |
| Graduate: DEACTIVATE students need lostReasonId | C#17 |
| Graduate: leaveDate set on old memberships (no leave billing — all lessons finalized) | C#23 |
| Merge groups: source students move to dest, leave billing on source, new billing on dest | C#10, C#31, C#32 |
| Merge: source group deactivated, mergedIntoGroupId set | C#10 |
| Merge: transfer credits applied to dest periods | C#25 |
| Merge: destination capacity exceeded → error | C#3 |
| Merge: different levels → error | C#10 |
| Merge: source has unresolved trials → error | C#2 |
| Merge INDIVIDUAL groups: two 1-student individuals merge into one 2-student individual | C#22 |

### 5. `constraints.test.ts` — Specific Constraint Enforcement

| Test Case | Constraints |
|-----------|------------|
| Schedule conflict: add student to overlapping group → error | C#40 |
| Schedule conflict: transfer excludes source group from check | C#40 |
| Language enforcement: BEGINNER student (UZBEK) assigned to RUSSIAN teacher → error | C#40 |
| Language enforcement: INTERMEDIATE student → no enforcement (soft only) | C#40 |
| Capacity: add 7th student to GROUP (max 6) → error | C#3 |
| Trial limits: 3rd GROUP trial → auto non-trial | C#2 |
| Trial limits: 2nd INDIVIDUAL trial → auto non-trial | C#2 |
| Attendance init: records created for active members only (not left, not future join) | C#18 |
| Teacher rate required: create group with rateless teacher → error | C#14 |
| Days validation: [1,2,3] → Zod error | C#12 |
| Duration validation: 90 → Zod error | C#12a |

### 6. `promotions.test.ts` — Auto-Detection & Application

| Test Case | Constraints |
|-----------|------------|
| FAMILY: 2nd active family member → FAMILY promo auto-attached to both | — |
| FAMILY: member deactivated, drops below 2 → FAMILY promo expired, removed from future periods | — |
| FAMILY: updateStudent with family change → old family rechecked, new family rechecked (calls updateStudent action) | — |
| WIN_BACK: inactive student rejoins → WIN_BACK promo auto-attached | — |
| SEASONAL: active campaign window → promo attached at student creation + group join | — |
| REFERRAL: welcome promo attached immediately on referral recording; first real payment → referral COMPLETED, reward promo attached to referrer + applied to existing periods | — |
| REFERRAL + PROMO_CODE mutual exclusivity → error | — |
| TRIAL promo: commit attaches correct promo (GROUP 100%, INDIVIDUAL 50%) | — |

### 7. `teacher-management.test.ts` — Teachers, Rates, Pay

| Test Case | Constraints |
|-----------|------------|
| Create teacher with duplicate phone → error | — |
| Set availability with overlapping time blocks on same day → error | C#20 |
| Add rate change → new rate used for subsequent group creation | C#14 |
| Deactivate teacher with active groups → error | C#11 |
| Deactivate teacher with no active groups → success | C#11 |
| Generate teacher pay → correct per-student-hour calculation (students × hours × rate) | C#37 |
| Generate teacher pay uses rate effective at period start, not current rate | C#14 |
| Mark teacher paid → all UNPAID records for teacher in month updated to PAID | — |

### 8. `data-integrity.test.ts` — Post-Operation Verification

| Test Case | Constraints |
|-----------|------------|
| After transfer: no orphaned billing periods on source (future months deleted) | C#31 |
| After transfer: no dangling schedule slots (source membership closed) | — |
| After merge: source group inactive, all memberships have leaveDate | C#10 |
| After graduation: old group inactive, graduatedIntoGroupId set | C#23 |
| After lesson cancellation: slot deleted, replacement has correct originalLessonId | C#9 |
| paymentStatus consistency: verify all periods have correct status relative to amountPaid vs (amountDue - discountAmount) | C#16 |

---

## Implementation Plan

Write tests in this order — each phase builds on patterns from the previous. One phase per conversation to stay within context limits.

| Phase | File | Cases | Depends On | Status |
|-------|------|-------|-----------|--------|
| 1 | `happy-path.test.ts` | 14 | — | **Done** (14/14 passing) |
| 2 | `constraints.test.ts` | 11 | — | **Done** (11/11 passing) |
| 3 | `scheduling.test.ts` | 17 | — | **Done** (17/17 passing) |
| 4 | `billing.test.ts` | 10 | Scheduling (lesson counts for periods) | **Done** (10/10 passing) |
| 5 | `promotions.test.ts` | 9 | Billing (discount application to periods) | **Done** (9/9 passing) |
| 6 | `teacher-management.test.ts` | 9 | Scheduling (completed lessons for pay calc) | **Done** (9/9 passing) |
| 7 | `group-lifecycle.test.ts` | 13 | Billing + Scheduling (merge/grad need both) | **Done** (13/13 passing) |
| 8 | `data-integrity.test.ts` | 6 | All above (post-operation verification) | **Done** (6/6 passing) |

**Total: ~88 test cases across 8 files + smoke.test.ts (infrastructure).**

Phase ordering rationale:
- **Phases 1–2** test the simplest actions (student CRUD, constraint rejections) — fast to write, validates the test infrastructure works end-to-end with real actions.
- **Phase 3** establishes lesson/slot lifecycle which phases 4–7 depend on.
- **Phase 4** builds on lesson counts to verify billing period creation and payment flows.
- **Phase 5** builds on billing periods to verify discount application.
- **Phase 6** needs completed lessons to test teacher pay generation.
- **Phase 7** is the most complex (graduation + merge touch billing, scheduling, and memberships).
- **Phase 8** runs composite checks after multi-step operations from all prior phases.

---

## Production Bugs

Bugs discovered during test writing.

### BUG-001: `performLeaveBilling` FK constraint on future period deletion — RESOLVED

**File:** `src/lib/helpers/leave-billing.ts`

**What happened:** `performLeaveBilling` did `deleteMany` on future `StudentPaymentPeriod` records without first removing dependent records that had `onDelete: Restrict` FK constraints — specifically `AppliedPromotion` and `Payment` records linked to those future periods.

**Fix applied:** Before deleting future periods, `performLeaveBilling` now:
1. Deletes `AppliedPromotion` records on those future periods (these get re-created on the destination via `applyPromotionsToPeriods`)
2. Finds `Payment` records on future periods, adds their amounts to the overpayment total (for transfer credit or refund), then deletes them

All 9 previously blocked tests now pass.
