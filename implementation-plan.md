# Implementation Plan

Source of truth: `packages/database/DATA_MODEL.md` (business rules, 37 constraints) + `admin-panel-plan.md` (screen specs).

**Read those two documents before starting any phase.**

---

## Phase Overview

| Phase | What | Depends On | Key Constraints |
|-------|------|------------|-----------------|
| 0 | Foundation (seed, auth, shared UI) | — | C#6 |
| 1 | Teacher Management | 0 | C#11, C#14, C#20, C#34 |
| 2 | Student Management (basic) | 0 | C#1, C#7, C#17, C#34, C#35 |
| 3 | Groups & Group Details | 0, 1, 2 | C#2–4, C#8, C#12, C#12a–b, C#13, C#14, C#19, C#32, C#34, C#36 |
| 4 | Main Schedule | 3 | — |
| 5 | Reception | 3, 4 | — |
| 6 | Payments & No Payment List | 3 | C#15, C#16 |
| 7 | Lesson Operations | 1, 3 | C#9, C#20a, C#21, C#26–29, C#37 |
| 8 | Attendance | 3, 7 | C#18, C#30 |
| 9 | Student Transfers | 3, 6 | C#25, C#31 |
| 10 | Teacher Payments | 1, 7 | C#14 |
| 11 | Group Lifecycle (merge, graduation) | 3, 9 | C#10, C#22–24, C#33 |
| 12 | Promotions & Referrals | 6 | C#36 |
| 13 | Communication (SMS, calls) | 6 | — |

```
Phase 0 ─── Phase 1 (Teachers) ───┐
   │                               │
   ├─── Phase 2 (Students) ────────┤
   │                               ▼
   │                          Phase 3 (Groups) ──── Phase 4 (Schedule) ──── Phase 5 (Reception)
   │                               │
   │                               ├── Phase 6 (Payments) ──── Phase 9 (Transfers) ──── Phase 11 (Merge/Graduation)
   │                               │        │
   │                               │        ├── Phase 12 (Promotions)
   │                               │        └── Phase 13 (Communication)
   │                               │
   │                               └── Phase 7 (Lessons) ──── Phase 8 (Attendance)
   │                                        │
   │                                        └── Phase 10 (Teacher Pay)
```

---

## Code Architecture

Established once, reused in every phase.

| Layer | Location | Convention |
|-------|----------|------------|
| Zod schemas | `src/schemas/*.ts` | One file per entity. Use helpers from `helpers.ts`. Follow `tech/database-first-validation-guide.md`. |
| Queries | `src/lib/queries/*.ts` | Read-only. **No** `'use server'`. Called from Server Components. |
| Actions | `src/lib/actions/*.ts` | Mutations only. **Must have** `'use server'`. Called from Client Components. |
| Helpers | `src/lib/helpers/*.ts` | Shared business logic (billing calculation, lesson scheduling, payment status). Imported by actions. |
| Pages | `src/app/(admin)/**/page.tsx` | Server Components — fetch data, pass to client components. |
| Components | `src/components/<entity>/` | Tables, forms, dialogs. Client Components where interactivity is needed. |

---

## Phase 0: Foundation

**Goal:** Seed data exists, auth works, shared UI patterns are established so every subsequent phase can reuse them.

### Seed Data

Already implemented in `packages/database/prisma/seed.ts`. Verify these exist in the live DB:

- [x] Holidays — Uzbekistan 2026 public holidays
- [x] TransferReason — 6 entries (Teacher dissatisfaction, Classmates dissatisfaction, Level too low, Level too advanced, Failed mid exam, Other)
- [x] LostReason — 4 entries (Taking a break, Too expensive, Didn't like online format, Other)
- [x] CancellationReason — 6 entries (Teacher absence, Low attendance, Student request, Scheduling conflict, Administrative, Other)
- [x] PriceSetting — 4 rows: (GENERAL|IELTS) × (GROUP|INDIVIDUAL), all multiples of 1,000 UZS **(C#6)**
- [x] AdminUser — super admin (Vladimir) + admin (Laziz)

### Auth

- [x] Telegram Login Widget on login page
- [x] Session management (JWT cookie via `jose`, 7-day expiry)
- [x] Auth middleware: verify JWT in Edge, redirect to /login if invalid
- [x] `requireAdmin()` in admin layout: DB-level check (admin exists + isActive)
- [x] Role guard (`requireRole("SUPER_ADMIN")`) for destructive actions
- [ ] ~~Dev-mode bypass~~ — removed; using real Telegram auth in all environments

### Shared UI Components

These are used across every feature — build once before Phase 1.

- [x] Data table component (TanStack Table wrapper — sortable, filterable, pagination)
- [x] Form pattern (shadcn/ui form — react-hook-form + zod resolver)
- [x] Confirmation dialog (for destructive actions)
- [x] Toast notifications (Sonner, added to root layout)
- [x] Status badge component (student, payment, lesson, group, teacherPay statuses)
- [x] Sheet/drawer component (shadcn/ui sheet — for side panels)

### Files

```
# Auth (done)
src/lib/auth-edge.ts                    ← Edge-compatible JWT (createSessionToken, verifySessionToken)
src/lib/auth.ts                         ← Node-only session/auth helpers (getCurrentAdmin, requireAdmin, validateTelegramAuth)
src/lib/actions/auth.ts                 ← Server actions (loginWithTelegram, logout)
src/app/login/page.tsx                  ← Telegram Login Widget page
src/components/auth/login-form.tsx      ← Login form client component
src/middleware.ts                        ← Edge auth check on all routes

# Shared UI (todo)
src/components/ui/data-table.tsx        ← TanStack Table wrapper
src/components/ui/confirmation-dialog.tsx
src/components/ui/status-badge.tsx
```

---

## Phase 1: Teacher Management

**Goal:** Fully functional `/teachers` tab — list, create, edit, availability, rates, deactivation.

### Features

- [ ] **Teacher list** — table with: name, phone, levels, language capabilities, active status, group count
  - Sort by name, filter by level and active status
- [ ] **Create teacher**
  - Fields: firstName, lastName, phone, levels[], canTeachUzbek, canTeachRussian, canTeachEnglishOnly
  - On create: also create initial `TeacherRateChange` with effectiveFrom = today, changedById = null **(C#14)**
  - Validation: phone unique (DB @unique), at least one level selected
- [ ] **Edit teacher** — same fields as create, phone uniqueness re-check
- [ ] **Teacher detail page** — profile info, availability grid, rate history, groups taught
- [ ] **TeacherAvailability management**
  - Add/remove availability blocks per day
  - Overlap validation **(C#20)**: blocks for the same dayOfWeek must not overlap in time
  - Time format validation **(C#34)**: all times in HH:mm
- [ ] **TeacherRateChange management**
  - View rate history (groupLessonRate + individualLessonRate + effectiveFrom)
  - Add new rate entry — UI prefills current values **(C#14)**
  - effectiveFrom must be first of a month
- [ ] **Teacher deactivation**
  - Guard: if teacher has active groups → block, show which groups need reassignment first **(C#11)**
  - On deactivate: set isActive=false, deactivatedAt=now, deactivatedById=current admin
  - Note: the group-reassignment workflow itself is built in Phase 7 (permanent teacher change)

### Files

```
src/schemas/teacher.ts
src/lib/queries/teachers.ts
src/lib/actions/teachers.ts
src/app/(admin)/teachers/page.tsx              ← list
src/app/(admin)/teachers/new/page.tsx          ← create form
src/app/(admin)/teachers/[id]/page.tsx         ← detail
src/app/(admin)/teachers/[id]/edit/page.tsx    ← edit form
src/components/teachers/teacher-table.tsx
src/components/teachers/teacher-form.tsx
src/components/teachers/availability-editor.tsx
src/components/teachers/rate-history.tsx
```

---

## Phase 2: Student Management (Basic)

**Goal:** Student CRUD, Family management, basic `/students` tab. No group assignment yet — that's Phase 3.

### Features

- [ ] **Family CRUD**
  - Create: parentFirstName, parentLastName, parentPhone
  - Phone dedup warning **(C#35)**: search existing families by parentPhone before creating — "A family with this phone already exists, link to it instead?"
  - Search families by parentPhone, parentName, or linked student
- [ ] **Student list** — table with: CRM code, name, phone, level, status, current group (empty for now)
  - Search by: name, CRM code, phone
  - Filter by: level, status (AWAITING_ASSIGNMENT / ACTIVE / INACTIVE)
- [ ] **Create student**
  - Fields: firstName, lastName, phone, dateOfBirth, level, preferredDays[], preferredStartTime, preferredLanguage, familyId, comment
  - Phone uniqueness **(C#1)**: DB @unique, show friendly error
  - Minor enrollment **(C#7)**: if dateOfBirth makes student under 18 at creation → familyId required (Zod refine)
  - Time format **(C#34)**: preferredStartTime in HH:mm
  - CRM code auto-generated by DB trigger (from sequenceNumber)
  - Status defaults to AWAITING_ASSIGNMENT
- [ ] **Edit student** — same fields, phone uniqueness re-check
- [ ] **Student detail page** — personal info, level, status, family info
  - Tabs for group history, payments, communication added in later phases
- [ ] **Deactivate student**
  - Requires lostReasonId **(C#17)** — show LostReason selector
  - otherLostReason free text if reason isOther
  - Sets: status=INACTIVE, inactivatedAt=now, inactivatedById=current admin, lostReasonId
  - Warn if student has active memberships (should handle those first)
- [ ] **Reactivate student** — INACTIVE → AWAITING_ASSIGNMENT, clear inactivatedAt/By/lostReason fields

### Files

```
src/schemas/student.ts
src/schemas/family.ts
src/lib/queries/students.ts
src/lib/queries/families.ts
src/lib/actions/students.ts
src/lib/actions/families.ts
src/app/(admin)/students/page.tsx              ← list
src/app/(admin)/students/new/page.tsx          ← create form
src/app/(admin)/students/[id]/page.tsx         ← detail
src/app/(admin)/students/[id]/edit/page.tsx    ← edit form
src/components/students/student-table.tsx
src/components/students/student-form.tsx
src/components/students/student-filters.tsx
src/components/families/family-form.tsx
src/components/families/family-search.tsx
```

---

## Phase 3: Groups & Group Details

**Goal:** Group creation with full lesson pre-creation cascade, group membership with billing period pre-creation, Group Details screen.

This is the most complex phase — group creation triggers Lessons, TeacherScheduleSlots, and GroupTeacherHistory. Membership creation triggers StudentPaymentPeriods.

### Group CRUD

- [ ] **Create group form**
  - Fields: type (GROUP/INDIVIDUAL), teacherId, days[], startTime, durationMinutes, level, startDate, maxStudents, zoomLink
  - Days validation **(C#12)**: only [1,3,5] or [2,4,6]
  - Duration validation **(C#12a)**: only 60 or 80
  - endDate auto-calculated **(C#19)**: day < 15 → end of startMonth+2; day >= 15 → end of startMonth+3
  - Time format **(C#34)**: startTime in HH:mm
  - maxStudents default: 6 for GROUP, 1 for INDIVIDUAL
- [ ] **On group create — single transaction (C#4, C#8):**
  1. Create Group record (endDate auto-calculated)
  2. Pre-create all Lesson records from startDate through endDate, matching day pattern, skipping Holidays
     - Each lesson: teacherId + originalTeacherId from group teacher, startTime from group, status=SCHEDULED, sequential lessonNumber
  3. Pre-create TeacherScheduleSlot for each lesson (unique constraint on teacherId+date+startTime prevents double-booking)
  4. Create initial GroupTeacherHistory (teacherId, startDate=group.startDate, endDate=null)
- [ ] **Group list** — table with: publicId, type, level, progressStage, teacher, days, time, students/max, active
- [ ] **Edit group**
  - days[] immutable after creation **(C#12b)** — field disabled, tooltip explains why
  - startTime change **(C#13)**: cascade update all future SCHEDULED lessons' startTime + swap TeacherScheduleSlots — same transaction
  - Editable: level, progressStage, maxStudents, zoomLink, skipAutoGraduation
- [ ] **Group detail page** — header with publicId, type, level, progressStage, teacher, days, time, startDate–endDate

### Group Membership

- [ ] **Add student to group**
  - Capacity check **(C#3)**: count active memberships (leaveDate IS NULL), reject if >= maxStudents
  - Fields: studentId, joinDate, isTrial, lessonsStart, comment
  - assignedById = current admin
- [ ] **On non-trial membership create — billing period pre-creation (C#32):**
  1. Count pre-created Lessons per calendar month from joinDate through group endDate
  2. Create `StudentPaymentPeriod` per month:
     - pricePerLesson: look up PriceSetting (derive levelCategory from group level, most recent where effectiveFrom <= period start) **(C#14)**
     - amountDue = totalLessons × pricePerLesson
     - First month: isPartialPeriod = true if joining after the 1st
  3. Apply active StudentPromotions if any exist, clamp discountAmount to amountDue **(C#36)**
  - Trial students (isTrial=true): NO billing periods created
- [ ] **Trial membership resolution (C#2):**
  - Commit (set isTrial=false): trigger billing period pre-creation from original joinDate
  - Remove (set leaveDate): student leaves without committing
  - **Stale trial alert**: persistent visual indicator for isTrial=true AND joinDate < today — this is urgent
- [ ] **Student activation**: when first non-trial membership created → set Student.status=ACTIVE, activatedAt, activatedById
- [ ] **Group Details student table** (from admin-panel-plan.md):
  - Columns: #, CRM code, start date, name, surname, phone, uncertain, lessons start, lessons paid, active, comment
  - "Lessons paid" derived from StudentPaymentPeriod data for current month

### Shared Helpers (reused in later phases)

- [ ] `src/lib/helpers/lesson-generation.ts` — generate lesson dates from startDate to endDate, matching day pattern, skipping holidays. Reused for graduation (Phase 11).
- [ ] `src/lib/helpers/billing.ts` — create billing periods for a membership, apply promotions, price lookup from PriceSetting. Reused for transfers (Phase 9), merge/graduation (Phase 11).

### Files

```
src/schemas/group.ts
src/schemas/group-membership.ts
src/lib/queries/groups.ts
src/lib/queries/group-memberships.ts
src/lib/actions/groups.ts
src/lib/actions/group-memberships.ts
src/lib/helpers/lesson-generation.ts
src/lib/helpers/billing.ts
src/app/(admin)/groups/[id]/page.tsx           ← Group Details
src/components/groups/group-form.tsx
src/components/groups/group-table.tsx
src/components/groups/group-detail-header.tsx
src/components/groups/student-roster.tsx       ← the student table within Group Details
src/components/groups/add-student-dialog.tsx
src/components/groups/trial-alert.tsx
```

---

## Phase 4: Main Schedule

**Goal:** The primary view — two schedule grids showing the operational pulse of the school.

### Features

- [ ] **Two grids: MWF (days [1,3,5]) and TTS (days [2,4,6])**
  - Rows = active teachers, sorted by name
  - Columns = 5 fixed time slots: 14:00, 15:30, 17:00, 18:30, 20:00
- [ ] **Each cell shows** (from admin-panel-plan.md):
  - Type indicator: GR / IND
  - publicId (e.g., GR-1, IND-3)
  - Level
  - Progress stage (beg / mid / fin)
  - Paid count / total (e.g., "3/5", "4+1T/6" for trials)
- [ ] **Empty cells** = open slots, visually distinct
- [ ] **Click cell** → navigate to Group Details page (Phase 3)
- [ ] **Visual indicator** for groups with unpaid students (e.g., red text on paid count)

### Query

The schedule query joins:
- Active teachers (rows)
- Active groups per teacher, grouped by days pattern (which grid)
- Active membership count per group (denominator)
- Paid count: current month's `StudentPaymentPeriod WHERE paymentStatus = PAID` (numerator)
- Trial count: active memberships WHERE isTrial = true (displayed as "+1T")

### Files

```
src/lib/queries/schedule.ts
src/app/(admin)/schedule/page.tsx              ← rewrite existing placeholder
src/components/schedule/schedule-grid.tsx
src/components/schedule/schedule-cell.tsx
```

---

## Phase 5: Reception

**Goal:** Student pipeline — see awaiting students, assign them to groups.

### Features

- [ ] **Reception table** (from admin-panel-plan.md):
  - Filter: students WHERE status = AWAITING_ASSIGNMENT
  - Columns: #, CRM code, name, surname, phone, level, created date, comment, preferred days, preferred time
  - Sort by creation date (oldest first)
- [ ] **Assign-to-group workflow**:
  - "Assign" button opens group selection dialog
  - Show compatible groups: matching level (recommended), open seats, grouped by day pattern
  - On assign: create GroupMembership → triggers billing (Phase 3 logic) → set Student.status=ACTIVE, activatedAt, activatedById
  - Student disappears from Reception
- [ ] **Count badge**: total awaiting students shown prominently (sidebar badge + page header)

### Files

```
src/lib/queries/reception.ts
src/lib/actions/reception.ts
src/app/(admin)/reception/page.tsx             ← rewrite existing placeholder
src/components/reception/reception-table.tsx
src/components/reception/assign-dialog.tsx
```

---

## Phase 6: Payments & No Payment List

**Goal:** Payment recording, payment status management, the daily ops tool.

### Features

- [ ] **No Payment List** (from admin-panel-plan.md):
  - Prominent unpaid count at top (e.g., "35 unpaid")
  - Table: CRM code, name, surname, level, group, payment amount due, phone
  - Query: `StudentPaymentPeriod WHERE paymentStatus != PAID AND periodYear = current year AND periodMonth = current month`
  - Search by Student.phone AND Family.parentPhone (parent sends payment receipt via Telegram, admin searches by phone to find the right student)
- [ ] **Record payment**
  - Fields: amount, paymentMethod (click/payme/cash), note
  - On record: create Payment, update StudentPaymentPeriod.amountPaid, recalculate paymentStatus **(C#16)**
- [ ] **Payment status helper (C#16)** — single function, used everywhere:
  - `amountPaid >= (amountDue - discountAmount)` → PAID
  - `amountPaid > 0` → PARTIALLY_PAID
  - else → UNPAID
  - Never update amountPaid or paymentStatus independently
- [ ] **Payment history per student** — list of Payment records with date, amount, method, who recorded
- [ ] **Manual period adjustment (C#15)**
  - Admin can edit: amountDue, totalLessons, discountAmount (error correction, dispute resolution)
  - On save: create PaymentPeriodAdjustment (audit trail with before/after snapshots), recalculate paymentStatus
- [ ] **Student profile enhancement**: add payments tab showing billing periods + payment history

### Files

```
src/schemas/payment.ts
src/lib/queries/payments.ts
src/lib/actions/payments.ts
src/lib/helpers/payment-status.ts              ← shared helper (C#16)
src/app/(admin)/payments/page.tsx              ← rewrite existing placeholder
src/components/payments/no-payment-table.tsx
src/components/payments/record-payment-dialog.tsx
src/components/payments/period-editor.tsx
src/components/payments/payment-history.tsx
```

---

## Phase 7: Lesson Operations

**Goal:** Lesson lifecycle — completion, cancellation, rescheduling, substitutions, teacher unavailability handling.

### Lesson Completion

- [ ] **Mark lesson COMPLETED**
  - Set completedAt = now
  - Snapshot activeStudentCount **(C#37)**: count active members (leaveDate IS NULL) as of lessonDate, **not** as of the moment completion is recorded
  - Status: SCHEDULED → COMPLETED

### Teacher Unavailability & Pending Resolution

- [ ] **Record TeacherUnavailability** — date, optional startTime/endTime, reason
  - Overlap validation **(C#20a)**: same date, no overlapping time ranges; whole-day entry conflicts with any other on that date
  - Auto-detection **(C#28)**: find SCHEDULED lessons for that teacher on the affected date (matching time range) → set status=PENDING_RESOLUTION, pendingAt=now
- [ ] **PENDING_RESOLUTION alert (C#29)**
  - Persistent visual indicator (sidebar badge or header alert, like stale trials)
  - List: lessons WHERE status = PENDING_RESOLUTION, ordered by pendingAt ASC (oldest first)
- [ ] **Resolve: assign substitute**
  - Select substitute teacher (check their availability + no schedule conflicts)
  - Update lesson.teacherId → substitute
  - Swap TeacherScheduleSlot (delete original teacher's, create substitute's)
  - Status → SCHEDULED, clear pendingAt
- [ ] **Resolve: cancel + append** — triggers cancellation flow below

### Cancellation & Rescheduling (C#9)

- [ ] **Cancel a lesson:**
  1. Set status=CANCELLED, cancelledAt, cancelledById, cancellationReasonId (+ otherCancellationReason if isOther)
  2. Delete TeacherScheduleSlot (frees the time)
  3. Create replacement Lesson at next valid date after endDate (matching day pattern, skip holidays)
  4. Replacement: rescheduledFromId → cancelled lesson, originalLessonId → chain root (if cancelled has originalLessonId, copy it; else use cancelled lesson's own ID) — **critical for billing correctness**
  5. Create TeacherScheduleSlot for replacement
  6. Update Group.endDate to new last lesson date

### Individual Lesson Operations

- [ ] **Student cancellation (C#26)**
  - Max 2 per calendar month: count CANCELLED lessons for this individual group where cancellationReasonId = "Student request"
  - Min 24h advance notice: reject if < 24h before lesson
  - Same cancel + append flow as above
  - TeacherScheduleSlot deleted (teacher IS free — student cancelled)
- [ ] **Offline reschedule (C#27)**
  - Set originalDate/originalStartTime → preserve old values
  - Update lessonDate/startTime → new values
  - Swap TeacherScheduleSlot (delete old, create new)
  - Does NOT count toward cancellation limit
  - Only for INDIVIDUAL groups

### Permanent Teacher Change (C#21)

- [ ] **Change a group's teacher permanently** (not a one-off substitution):
  1. Update Group.teacherId → new teacher
  2. Close current GroupTeacherHistory record (set endDate = today)
  3. Create new GroupTeacherHistory (new teacher, startDate = today, endDate = null)
  4. Update ALL future SCHEDULED lessons: set **both** teacherId AND originalTeacherId → new teacher
  5. Swap TeacherScheduleSlots for those future lessons (delete old teacher's, create new teacher's)
- [ ] This also completes teacher deactivation **(C#11)**: admin can now reassign each group before deactivating

### Files

```
src/schemas/lesson.ts
src/schemas/teacher-unavailability.ts
src/lib/queries/lessons.ts
src/lib/actions/lessons.ts
src/lib/actions/teacher-unavailability.ts
src/lib/helpers/lesson-scheduling.ts           ← find next valid date, skip holidays
src/components/lessons/lesson-completion.tsx
src/components/lessons/cancellation-dialog.tsx
src/components/lessons/substitute-picker.tsx
src/components/lessons/pending-resolution-list.tsx
src/components/lessons/reschedule-dialog.tsx
src/components/teachers/unavailability-form.tsx
src/components/teachers/teacher-change-dialog.tsx
```

---

## Phase 8: Attendance

**Goal:** Per-lesson attendance tracking.

### Features

- [ ] **Attendance pre-creation (C#18)**: when opening attendance for a lesson, create records for all active members (leaveDate IS NULL) with isAbsent=false
- [ ] **Mark absences** — toggle isAbsent per student per lesson
- [ ] **Attendance view** per group — grid: lessons as columns × students as rows, showing present/absent
- [ ] **Note: absences do NOT affect billing or status (C#30)** — tracking only. No freezes, no free absences for group lessons.

### Files

```
src/lib/queries/attendance.ts
src/lib/actions/attendance.ts
src/components/attendance/attendance-grid.tsx
```

---

## Phase 9: Student Transfers

**Goal:** Move students between groups with correct billing adjustments.

### Features

- [ ] **Transfer student action — single transaction:**
  1. Set leaveDate on source GroupMembership + transferReasonId (+ otherTransferReason if isOther)
  2. **Per-membership leave billing — source group (C#31):**
     - a) Current month: reduce totalLessons to lessons up to leaveDate, recalculate amountDue, create PaymentPeriodAdjustment
     - b) Future months: hard-delete billing periods (they're untouched — UNPAID, no payments/adjustments/promotions)
     - c) Recalculate paymentStatus on current period
  3. Create new GroupMembership in destination group (triggers C#32: billing period pre-creation)
  4. **Transfer credit (C#25)**: if overpayment on source (amountPaid > amountDue - discountAmount), create Payment with isTransferCredit=true on destination period
  5. Student status stays ACTIVE — transfer ≠ leaving
  6. Set previousMembershipId on new membership → old membership (traceability)
- [ ] **Transfer UI** — from Group Details or Student profile
  - Select destination group (same level recommended, show available seats)
  - Select transfer reason (from TransferReason table)
  - Preview billing impact before confirming (old period adjusted, credit transferred, new periods created)
- [ ] **Student profile**: show transfer/group history (via previousMembershipId chain and leaveDate/transferReason)

### Shared Helpers

- [ ] `src/lib/helpers/leave-billing.ts` — per-membership leave billing logic. Reused for merge (Phase 11) and dropout (Phase 2 deactivation enhancement).

### Files

```
src/lib/actions/transfers.ts
src/lib/helpers/leave-billing.ts
src/components/transfers/transfer-dialog.tsx
src/components/transfers/group-picker.tsx
src/components/transfers/billing-preview.tsx
```

---

## Phase 10: Teacher Payments

**Goal:** Monthly teacher pay generation and tracking.

### Features

- [ ] **Generate teacher pay for a month:**
  - For each teacher, for each group they taught in that month:
    - Count completed lessons WHERE teacherId = teacher AND lessonDate in month
    - Sum activeStudentCount across those lessons → totalStudentLessons
    - Look up rate from TeacherRateChange: most recent WHERE effectiveFrom <= first day of month, using Group.type to select groupLessonRate vs individualLessonRate **(C#14)**
    - amount = totalStudentLessons × rate
  - Create TeacherPaymentPeriod records
  - Substitute handling: counts for whoever actually taught (teacherId, not originalTeacherId)
- [ ] **Teacher pay list** — table: teacher, group, period, lessons completed, student-lessons, rate, amount, status
- [ ] **Mark as paid** — set status=PAID, paidAt
- [ ] **Teacher profile enhancement**: add pay history tab

### Files

```
src/lib/queries/teacher-payments.ts
src/lib/actions/teacher-payments.ts
src/components/teacher-payments/generate-dialog.tsx
src/components/teacher-payments/pay-table.tsx
```

---

## Phase 11: Group Lifecycle (Merge & Graduation)

**Goal:** End-of-life group operations — merging small groups and graduating to next level.

### Group Merge (C#10, C#22)

- [ ] **Merge group A into group B:**
  1. Validate: A and B are compatible (same level, B has capacity for A's students)
  2. Set A.mergedIntoGroupId = B.id, A.isActive = false
  3. Set leaveDate on all A's active memberships → triggers per-membership leave billing **(C#31)**: overpayment becomes transfer credit on B (not a refund)
  4. Create new memberships in B with previousMembershipId → triggers billing period pre-creation **(C#32)**
  5. Works for both GROUP and INDIVIDUAL types **(C#22)**
- [ ] **Merge UI**: select surviving group, preview student movements and billing impact, confirm

### Group Graduation (C#23, C#24, C#33)

- [ ] **Graduation workflow:**
  1. Validate: no SCHEDULED or PENDING_RESOLUTION lessons remain (all COMPLETED or CANCELLED)
  2. Skip if skipAutoGraduation = true or level = IELTS (no next level per C#24)
  3. Create new group at next level **(C#24)**: BEGINNER→ELEMENTARY→PRE_INTERMEDIATE→INTERMEDIATE→UPPER_INTERMEDIATE→IELTS
     - Same teacher, days, startTime, durationMinutes, maxStudents
     - startDate = next valid lesson date after old group's last lesson (matching day pattern, skip holidays)
     - endDate auto-calculated, progressStage = BEGINNING
     - Price from PriceSetting (derive levelCategory from new level)
  4. Pre-create lessons + TeacherScheduleSlots + GroupTeacherHistory for new group (reuse Phase 3 helpers)
  5. Admin selects which students continue to new group
  6. Create memberships with previousMembershipId → billing period pre-creation **(C#32)**
  7. Auto-update Student.level for continuing students **(C#33)**
  8. Close old group: isActive=false, graduatedIntoGroupId set, leaveDate on ALL active memberships (record-keeping only — billing periods already finalized, does NOT trigger leave billing C#31)
- [ ] **Edge cases:**
  - Students who don't continue: leaveDate set, no new membership, status stays ACTIVE unless separately deactivated
  - mergedIntoGroupId and graduatedIntoGroupId are mutually exclusive (Zod validation)
- [ ] **Graduation UI**: show student selection (continuing vs leaving), preview new group details, confirm

### Files

```
src/lib/actions/group-merge.ts
src/lib/actions/group-graduation.ts
src/components/groups/merge-dialog.tsx
src/components/groups/graduation-dialog.tsx
```

---

## Phase 12: Promotions & Referrals

**Goal:** Discount management and referral tracking.

### Promotions

- [ ] **Promotion CRUD**
  - Fields: name, type, discountType, discountPercent or discountAmount (exactly one — Zod XOR), levels[], groupTypes[], isRecurring, recurringMonths, maxUsesPerStudent, maxUsesTotal, validityDays, validFrom/validTo, code, isActive
- [ ] **Assign promotion to student** — create StudentPromotion, calculate expiresAt from validityDays
- [ ] **Apply promotions during billing** (enhance Phase 3 billing helper):
  - Query active StudentPromotions
  - Calculate discount per period, create AppliedPromotion records
  - Clamp total discountAmount to amountDue **(C#36)** — a student never pays less than zero
  - For recurring: increment monthsUsed, check recurringMonths / expiresAt
- [ ] **Promotion list** — usage count, active/inactive toggle

### Referrals

- [ ] **Record referral**: referrer → referred student, using referralCode
  - Validate: no self-referral (Zod), each student can only be referred once (referredStudentId @unique)
- [ ] **Referral completion**: when referred student makes first payment → status=COMPLETED, completedAt
  - Create StudentPromotions for both referrer (billing credit) and referred (first-month discount)

### Files

```
src/schemas/promotion.ts
src/lib/queries/promotions.ts
src/lib/actions/promotions.ts
src/lib/actions/referrals.ts
src/components/promotions/promotion-table.tsx
src/components/promotions/promotion-form.tsx
src/components/promotions/assign-dialog.tsx
```

---

## Phase 13: Communication

**Goal:** SMS payment reminders and call history logging.

### Features

- [ ] **SMS sending**
  - Single student or bulk (multi-select from No Payment List)
  - Template-based message
  - Create SmsHistory record (status=SENT)
  - Delivery tracking: provider callback updates to DELIVERED or FAILED
  - SMS provider integration (external service — specific provider TBD)
- [ ] **Call history**
  - Log a call: studentId, note, calledById
  - View call history per student
- [ ] **Student profile enhancement**: add communication tab (SMS + call history)

### Files

```
src/lib/actions/sms.ts
src/lib/actions/calls.ts
src/lib/queries/communication.ts
src/components/communication/sms-dialog.tsx
src/components/communication/call-log.tsx
```

---

## Later Scope

Not in the initial build. Tracked here so nothing is forgotten.

- [ ] **Uncertain List** — auto-criteria (3+ absences or 3+ incomplete homework) + manual isUncertain flag. Query-based view.
- [ ] **Exam List** — Exam model exists, needs management UI per group
- [ ] **Lost List** — inactive students with reasons, phone for reactivation campaigns
- [ ] **Payment List** — financial reporting: filter by year/month/teacher/group, teacher salary overview
- [ ] **amoCRM integration** — API polling for leads in "Ready for Group" stage → auto-create student records
- [ ] **Zoom integration** — auto-create meetings per group (see `tech/zoom-integration-plan.md`)
- [ ] **Analytics dashboard** — student counts, revenue, utilization, homework completion
- [ ] **Bulk student actions** — mass payment recording, mass SMS, mass transfer
- [ ] **Content management** — deferred, teachers use physical textbooks
- [ ] **Payment gateway integration** — Click, Payme (currently manual recording only)

---

## Constraint Coverage

Every one of DATA_MODEL.md's 37 application-level constraints, mapped to a phase.

| # | Constraint | Phase | Done |
|---|-----------|-------|------|
| 1 | Student.phone uniqueness | 2 | [ ] |
| 2 | Trial membership staleness alert | 3 | [ ] |
| 3 | Group.maxStudents enforcement | 3 | [ ] |
| 4 | TeacherScheduleSlots per-date pre-creation | 3 | [ ] |
| 5 | Exam duplicate validation | Later | [ ] |
| 6 | Price must be multiple of 1,000 | 0 | [ ] |
| 7 | Minor enrollment requires Family | 2 | [ ] |
| 8 | Lesson pre-creation on group create | 3 | [ ] |
| 9 | Cancellation + rescheduling flow | 7 | [ ] |
| 10 | Group merge | 11 | [ ] |
| 11 | Teacher deactivation guard | 1 (guard), 7 (reassignment) | [ ] |
| 12 | Group.days validation ([1,3,5] or [2,4,6]) | 3 | [ ] |
| 12a | Group.durationMinutes validation (60 or 80) | 3 | [ ] |
| 12b | Group.days immutability after creation | 3 | [ ] |
| 13 | Group.startTime change cascades to lessons | 3 | [ ] |
| 14 | Rate/price effectiveFrom lookup | 1 (rates), 3 (prices) | [ ] |
| 15 | StudentPaymentPeriod manual editing | 6 | [ ] |
| 16 | paymentStatus sync helper | 6 | [ ] |
| 17 | lostReasonId ↔ Student.status coupling | 2 | [ ] |
| 18 | Attendance pre-creation | 8 | [ ] |
| 19 | Group.endDate > startDate + auto-calculation | 3 | [ ] |
| 20 | TeacherAvailability overlap validation | 1 | [ ] |
| 20a | TeacherUnavailability overlap validation | 7 | [ ] |
| 21 | Permanent teacher change (cascade to lessons) | 7 | [ ] |
| 22 | mergedIntoGroupId for both GROUP and INDIVIDUAL | 11 | [ ] |
| 23 | Group graduation workflow | 11 | [ ] |
| 24 | Level progression order | 11 | [ ] |
| 25 | Transfer billing (credit to new group) | 9 | [ ] |
| 26 | Individual lesson cancellation limits | 7 | [ ] |
| 27 | Individual lesson offline reschedule | 7 | [ ] |
| 28 | TeacherUnavailability auto-detection | 7 | [ ] |
| 29 | PENDING_RESOLUTION alert | 7 | [ ] |
| 30 | Absence policy (no billing impact) | 8 | [ ] |
| 31 | Per-membership leave billing | 9 (transfer), 11 (merge) | [ ] |
| 32 | Billing period pre-creation | 3 | [ ] |
| 33 | Student.level auto-update on graduation | 11 | [ ] |
| 34 | Time format HH:mm validation | 1, 2, 3 | [ ] |
| 35 | Family.parentPhone dedup warning | 2 | [ ] |
| 36 | Discount cap (discountAmount ≤ amountDue) | 3, 12 | [ ] |
| 37 | activeStudentCount snapshot timing | 7 | [ ] |

### DB-Level Constraints (already applied via migration)

These live in `prisma/migrations/data_integrity_constraints.sql` — not app-level, but verify they exist:

| Constraint | What |
|-----------|------|
| `active_membership_unique` | Partial unique index: one active membership (leaveDate IS NULL) per student per group |
| `student_crm_code_trigger` | BEFORE INSERT: computes crmCode from sequenceNumber |
| `group_public_id_trigger` | BEFORE INSERT: computes publicId (GR-N / IND-N) from type + sequenceNumber |
| `current_group_teacher_unique` | Partial unique index: one current teacher (endDate IS NULL) per group in GroupTeacherHistory |
