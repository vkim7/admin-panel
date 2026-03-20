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
| 3 | Groups & Group Details | 0, 1, 2 | C#2–4, C#8, C#12, C#12a–b, C#13, C#14, C#19, C#32, C#34, C#36, C#40 |
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
| 14 | Trial Tracking & Enforcement | 7, 8, 12 | C#38 |
| 15 | Reassignment & Orphan Detection | 11 | C#39 |
| 16 | Lost List & Win-Back | 2 | — |
| 17 | Scenario Testing | All | All |

```
Phase 0 ─── Phase 1 (Teachers) ───┐
   │                               │
   ├─── Phase 2 (Students) ────────┤
   │                               ▼
   │                          Phase 3 (Groups) ──── Phase 4 (Schedule) ──── Phase 5 (Reception)
   │                               │
   │                               ├── Phase 6 (Payments) ──── Phase 9 (Transfers) ──── Phase 11 (Merge/Graduation)
   │                               │        │                                                │
   │                               │        ├── Phase 12 (Promotions) ──┐                    └── Phase 15 (Reassignment)
   │                               │        │                           ├── Phase 14 (Trial Tracking)
   │                               │        └── Phase 13 (Communication)│
   │                               │                                    │
   │                               └── Phase 7 (Lessons) ──── Phase 8 (Attendance) ──┘
   │                                        │
   │                                        └── Phase 10 (Teacher Pay)

                                   Phase 2 ──── Phase 16 (Lost List & Win-Back)

                                   All phases ──── Phase 17 (Scenario Testing)
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

- [x] **Teacher list** — table with: name, phone, levels, language capabilities, active status, group count
  - Sort by name, filter by level and active status
- [x] **Create teacher**
  - Fields: firstName, lastName, phone, levels[], teachingLanguage (UZBEK / RUSSIAN / ANY)
  - teachingLanguage is a radio group: "Both" (ANY), "Uzbek", "Russian" — no default, admin must explicitly select
  - Validation: phone unique (DB @unique), at least one level selected, teachingLanguage required
- [x] **Edit teacher** — same fields as create, phone uniqueness re-check
- [x] **Teacher detail page** — profile info (teachingLanguage shown as "Both" / "Uzbek" / "Russian"), availability grid, rate history, groups taught. Trial tracking deferred to Phase 14.
- [x] **Teacher list table** — language column shows: ANY → "Both", UZBEK → "UZ", RUSSIAN → "RU"
- [x] **TeacherAvailability management**
  - Add/remove availability blocks per day
  - Overlap validation **(C#20)**: blocks for the same dayOfWeek must not overlap in time
  - Time format validation **(C#34)**: all times in HH:mm
- [x] **TeacherRateChange management**
  - View rate history (groupLessonRate + individualLessonRate + effectiveFrom)
  - Add new rate entry — UI prefills current values **(C#14)**
  - effectiveFrom must be first of a month
- [x] **Teacher deactivation**
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

- [x] **Family CRUD**
  - Create: parentFirstName, parentLastName, parentPhone
  - Phone dedup warning **(C#35)**: search existing families by parentPhone before creating — "A family with this phone already exists, link to it instead?"
  - Search families by parentPhone, parentName, or linked student
- [x] **Student list** — table with: CRM code, name, phone, level, status, current group (empty for now)
  - Search by: name, CRM code, phone
  - Filter by: level, status (AWAITING_ASSIGNMENT / ACTIVE / INACTIVE)
- [x] **Create student**
  - Fields: firstName, lastName, phone, dateOfBirth, level, progressStage (BEGINNING / MID / FINAL), preferredDays[], preferredTimeSlots[] (multi-select pills from TIME_SLOTS), preferredLanguage (UZBEK / RUSSIAN / ANY — required, no default), familyId, comment
  - progressStage set during placement alongside level — determines position on the linear level+stage scale (18 positions from BEGINNER:BEGINNING to IELTS:FINAL)
  - preferredLanguage is required for all students — no default value, admin must explicitly select. Hard enforcement at BEGINNER/ELEMENTARY (blocks assignment to incompatible teachers), soft preference at PRE_INTERMEDIATE+.
  - Phone uniqueness **(C#1)**: DB @unique, show friendly error
  - Minor enrollment **(C#7)**: if dateOfBirth makes student under 18 at creation → familyId required (Zod refine)
  - CRM code auto-generated by DB trigger (from sequenceNumber)
  - Status defaults to AWAITING_ASSIGNMENT
- [x] **Edit student** — same fields, phone uniqueness re-check
- [x] **Student detail page** — personal info, level + progressStage (shown as "Level · Stage" badge, e.g. "Elementary · MID"), status, family info
  - Tabs for group history, payments, communication added in later phases
- [x] **Deactivate student**
  - Requires lostReasonId **(C#17)** — show LostReason selector
  - otherLostReason free text if reason isOther
  - Sets: status=INACTIVE, inactivatedAt=now, inactivatedById=current admin, lostReasonId
  - Warn if student has active memberships (should handle those first)
- [x] **Reactivate student** — INACTIVE → AWAITING_ASSIGNMENT, clear inactivatedAt/By/lostReason fields

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

- [x] **Create group form**
  - Fields: type (GROUP/INDIVIDUAL), teacherId, days[], startTime, durationMinutes, level (no default preselection — user must explicitly choose), startDate, maxStudents, zoomLink
  - **Teacher rate guard**: reject group creation if the selected teacher has no rate history (must add rates before assigning to a group). Warning shown inline below teacher select.
  - Days validation **(C#12)**: only [1,3,5] or [2,4,6]
  - Duration validation **(C#12a)**: only 60 or 80
  - endDate auto-calculated **(C#19)**: day < 15 → end of startMonth+2; day >= 15 → end of startMonth+3
  - Time format **(C#34)**: startTime in HH:mm
  - maxStudents default: 6 for GROUP, 1 for INDIVIDUAL
  - **Time slot filtering by teacher availability**: start time dropdown only shows slots where the selected teacher has availability for the selected days. If teacher has no availability on selected days, dropdown is disabled with red message "No available slots for this teacher on selected days". Start time select is also disabled until both teacher and days are selected.
  - **Schedule pre-fill mode**: when created from `/schedule` page "+" button, teacher/days/startTime/type are pre-filled and disabled (non-editable) to prevent accidental changes. "Prefilled from schedule" description shown under days field.
- [x] **On group create — single transaction (C#4, C#8):**
  1. Create Group record (endDate auto-calculated)
  2. Pre-create all Lesson records from startDate through endDate, matching day pattern, skipping Holidays
     - Each lesson: teacherId + originalTeacherId from group teacher, startTime from group, status=SCHEDULED, sequential lessonNumber
  3. Pre-create TeacherScheduleSlot for each lesson (unique constraint on teacherId+date+startTime prevents double-booking)
  4. Create initial GroupTeacherHistory (teacherId, startDate=group.startDate, endDate=null)
- [x] **Group list** — table with: publicId, type, level, progressStage, teacher, days, time, students/max, active
- [x] **Edit group**
  - days[] immutable after creation **(C#12b)** — field disabled, tooltip explains why
  - startTime change **(C#13)**: cascade update all future SCHEDULED lessons' startTime + swap TeacherScheduleSlots — same transaction
  - Editable: maxStudents, startTime, zoomLink, skipAutoGraduation (level/progressStage non-editable per TODO_CH.md)
- [x] **Group detail page** — header with publicId, type, level, progressStage, teacher, days, time, startDate–endDate

### Group Membership

- [x] **Add students to group** (multi-student support)
  - Capacity check **(C#3)**: count active memberships (leaveDate IS NULL), reject if >= maxStudents
  - Fields: studentIds[], joinDate, isTrial (default true), comment
  - lessonsStart auto-calculated from joinDate (finds first lesson on or after joinDate)
  - assignedById = current admin
- [x] **On non-trial membership create — billing period pre-creation (C#32):**
  1. Count pre-created Lessons per calendar month from joinDate through group endDate
  2. Create `StudentPaymentPeriod` per month:
     - pricePerLesson: look up PriceSetting (derive levelCategory from group level, most recent where effectiveFrom <= period start) **(C#14)**
     - amountDue = totalLessons × pricePerLesson
     - First month: isPartialPeriod = true if joining after the 1st
  3. Promotions deferred to Phase 12 (discountAmount = 0 for now) **(C#36)**
  - Trial students (isTrial=true): NO billing periods created
- [x] **Trial membership resolution (C#2):**
  - Commit (set isTrial=false): trigger billing period pre-creation from original joinDate
  - Remove (set leaveDate): student leaves without committing
  - **Stale trial alert**: persistent visual indicator for isTrial=true AND joinDate < today — this is urgent
- [x] **Student activation**: when assigned to any group (trial or non-trial) → set Student.status=ACTIVE, activatedAt, activatedById. Student disappears from Reception immediately on assignment regardless of trial status.
- [x] **Multiple simultaneous groups**: a student can be in both a GROUP and INDIVIDUAL lesson at the same time (or multiple groups). Each membership has independent billing periods. The `active_membership_unique` constraint is per student+group, not per student globally. To add a student to a second group, use "Add student" from Group Details — no status change needed (student is already ACTIVE). **Schedule conflict detection (C#40):** when adding a student, check all their other active memberships for overlapping schedule (same days AND overlapping time window based on group duration). Block with error if conflict found.
- [x] **Group Details student table** (from admin-panel-plan.md):
  - Columns: #, CRM code, start date, name, surname, phone, uncertain (manual toggle), lessons start, lessons paid, status, comment
  - "Lessons paid" derived from StudentPaymentPeriod data for current month
  - Uncertain flag: manual admin toggle via `toggleUncertain` action (auto-triggers deferred to future)

### Shared Helpers (reused in later phases)

- [x] `src/lib/helpers/lesson-generation.ts` — generate lesson dates from startDate to endDate, matching day pattern, skipping holidays. Also: calculateEndDate, getLevelCategory, getProgressStage, calculateLessonsStart.
- [x] `src/lib/helpers/billing.ts` — create billing periods for a membership, price lookup from PriceSetting. Promotions deferred to Phase 12.

### Files

```
src/schemas/group.ts
src/schemas/group-membership.ts
src/lib/queries/groups.ts
src/lib/actions/groups.ts
src/lib/actions/group-memberships.ts
src/lib/helpers/lesson-generation.ts
src/lib/helpers/billing.ts
src/app/(admin)/groups/page.tsx
src/app/(admin)/groups/new/page.tsx
src/app/(admin)/groups/[id]/page.tsx           ← Group Details
src/app/(admin)/groups/[id]/edit/page.tsx
src/components/groups/group-form.tsx
src/components/groups/group-table.tsx
src/components/groups/student-list.tsx          ← the student table within Group Details
src/components/groups/add-student-dialog.tsx
src/components/groups/trial-resolution-dialog.tsx
```

---

## Phase 4: Main Schedule

**Goal:** The primary view — two schedule grids showing the operational pulse of the school.

### Features

- [x] **Two grids: MWF (days [1,3,5]) and TTS (days [2,4,6])**
  - Rows = active teachers, sorted by name
  - Columns = 11 fixed time slots: 7:00, 8:30, 10:00, 11:30, 13:00, 14:30, 16:00, 17:30, 19:00, 20:30, 22:00
- [x] **Each cell shows**:
  - Row 1: publicId (e.g., GR-1, IND-3) on the left, **teacher language** on the right (top-right corner)
    - Language display: "UZ" if teacher speaks only Uzbek, "RU" if only Russian, **nothing** if teacher speaks both (ANY) — "both" is the assumed default
  - Row 2: Level badge (short form: BEG, ELEM, Pre-Int, INT, Upper-Int, IELTS) + progress stage (BEG / MID / FIN) when not BEGINNING (BEGINNING is implied, omitted)
  - Row 3: Paid count / total (e.g., "3/5", "4+1T/6" for trials). Unpaid count shown in red if > 0.
- [x] **Cell color coding**: green border/bg when full (activeCount >= maxStudents), red border/bg when has open spots
- [x] **Click cell** → navigate to Group Details page (Phase 3)
- [x] **Visual indicator** for groups with unpaid students (red text on paid count)
- [x] **Empty cell states** based on TeacherAvailability:
  - Available slot: "+" button (dashed border, hover highlight) → links to `/groups/new?teacherId=X&days=1,3,5&startTime=14:30`
  - Unavailable slot: plain muted background (no interaction)
- [x] **Schedule → Group creation pre-fill**: clicking "+" passes teacherId, days, startTime as query params; GroupForm accepts `prefill` prop and pre-fills + disables those fields (teacher, days, start time, type) to prevent accidental changes

### Query

The schedule query joins:
- Active teachers with availability records (rows — teachers appear even with no groups if they have availability)
- Active groups per teacher, grouped by days pattern (which grid)
- Active membership count per group (denominator)
- Paid count: current month's `StudentPaymentPeriod WHERE paymentStatus = PAID` (numerator)
- Trial count: active memberships WHERE isTrial = true (displayed as "+1T")
- TeacherAvailability: used to determine which empty slots show "+" buttons (`isSlotInRange` checks if slot falls within availability window)

### Files

```
src/lib/constants.ts                           ← shared TIME_SLOTS, LEVEL_SHORT, LEVEL_LABEL, DAYS_LABEL, DAY_SHORT
src/lib/queries/schedule.ts
src/app/(admin)/schedule/page.tsx              ← rewrite existing placeholder
src/components/schedule/schedule-grid.tsx
src/components/schedule/schedule-cell.tsx
```

Also modified: `schemas/group.ts` (startTime validation against TIME_SLOTS), `components/groups/group-form.tsx` (time input → select dropdown, `prefill` prop for schedule pre-fill with disabled fields, time slot filtering by teacher availability), `queries/groups.ts` (teacher availability included in form query), `groups/new/page.tsx` (parses searchParams for pre-fill), `components/groups/group-table.tsx` and `groups/[id]/page.tsx` (import constants), `packages/database/prisma/seed.ts` (updated times to valid slots).

---

## Phase 5: Reception

**Goal:** Student pipeline — see awaiting students, assign them to groups.

### Features

- [x] **Reception table** (from admin-panel-plan.md):
  - Filter: students WHERE status = AWAITING_ASSIGNMENT
  - Columns: CRM code, name (links to student detail), phone, level (shown as "LEVEL · STAGE" badge), created date, preferred days, preferred time slots (as pills), comment, Assign button
  - Sort by creation date (oldest first), search by name
- [x] **Assign-to-group workflow**:
  - "Assign" button opens group selection dialog per student
  - **Student info bar**: level + progressStage badge, preferred days, preferred time slots, language preference (shown only for BEGINNER/ELEMENTARY students — at higher levels language isn't displayed since lessons are mainly in English)
  - Linear level+stage scale (`LEVEL_STAGE_ORDER` in constants.ts) — 18 positions from BEGINNER:BEGINNING to IELTS:FINAL
  - 3-tier group suggestions based on distance (only groups with available seats, within 3 stages):
    1. **Best match**: exact level+stage (distance 0) + matching days + time + language → sorted by seats DESC
    2. **Above**: groups 1–3 stages above student → sorted by distance ASC then seats DESC
    3. **Below**: groups 1–3 stages below student → sorted by distance ASC (closest first) then seats DESC
  - **Language hard-enforcement** at BEGINNER/ELEMENTARY: groups where teacher can't teach in student's preferred language are excluded entirely from suggestions AND blocked in the `addStudentsToGroup` server action. PRE_INTERMEDIATE+ is soft preference (sorting only, no blocking).
  - **Group row layout** (each suggestion):
    - Top line: publicId + language indicator (left, e.g. "GR-1 UZ") | level · stage (right, e.g. "ELEM · MID")
    - Bottom line: teacher name · seats (left, e.g. "Sarah Lee · 4/6") | days + time (right, e.g. "MWF 14:30")
    - Language indicator: "UZ" / "RU" shown next to publicId only when teacher speaks a single language; not shown for ANY (both)
    - Seats displayed as active/max (e.g. "4/6"), same format as schedule cells
  - Selected group highlighted with primary border + checkmark icon
  - Join date (date picker, defaults to today) + trial toggle on assignment
  - Trial description: "Trial students occupy a seat but no billing is created until committed."
  - On assign: reuses `addStudentsToGroup` → activates student (AWAITING_ASSIGNMENT → ACTIVE) regardless of trial status → triggers billing for non-trial only
  - Student disappears from Reception immediately, revalidates /reception path
- [x] **Count badge**: total awaiting students shown in sidebar badge (amber pill) + page header count
- [x] **Sidebar "Eng Admin" title**: clicking redirects to /schedule (the primary operational view)

### Files

```
src/lib/queries/reception.ts                   ← getReceptionStudents, getReceptionCount, getGroupsForAssignment
src/app/(admin)/reception/page.tsx             ← rewritten from placeholder
src/components/reception/reception-table.tsx
src/components/reception/assign-dialog.tsx
```

Also modified: `app-sidebar.tsx` (badge prop, "Eng Admin" links to /schedule), `layout.tsx` (fetches reception count), `actions/group-memberships.ts` (revalidate /reception, language hard-enforcement, trial student activation), `actions/students.ts` (revalidate /reception on status changes). No separate `actions/reception.ts` needed — reuses existing `addStudentsToGroup`.

---

## Phase 6: Payments & No Payment List

**Goal:** Payment recording, payment status management, the daily ops tool.

### Features

- [x] **No Payment List** (from admin-panel-plan.md):
  - Red "N unpaid" badge next to page title. No status column (all records are unpaid — redundant). Sidebar tab renamed to "No Payment".
  - Table: CRM code, name, level, group, due amount (with discount strikethrough), paid, phone (student + parent phone below). "Record →" button per row (matches Reception "Assign →" style). No inline edit button (adjustments done from student detail).
  - Query: `StudentPaymentPeriod WHERE paymentStatus != PAID AND periodYear = current year AND periodMonth = current month`
  - Search by Student.phone AND Family.parentPhone (parent sends payment receipt via Telegram, admin searches by phone to find the right student) — custom filter on client side, searches name + phone + parentPhone
- [x] **Record payment**
  - Fields: amount (prefilled with remaining balance), paymentMethod (click/payme/cash), note (optional, description below input)
  - Dialog shows: amount due, discount, paid so far, remaining
  - On record: create Payment, update StudentPaymentPeriod.amountPaid, recalculate paymentStatus **(C#16)**
- [x] **Payment status helper (C#16)** — `src/lib/helpers/payment-status.ts`, single function:
  - `amountPaid >= (amountDue - discountAmount)` → PAID
  - `amountPaid > 0` → PARTIALLY_PAID
  - else → UNPAID
  - Used by both `recordPayment` and `adjustPeriod` actions
- [x] **Payment history per student** — split into unpaid (always visible, sorted chronologically ascending: closest month first) and paid (collapsed under "Paid (N)" `<details>` summary, sorted newest first). Each period card shows: lessons, due, discount, paid, remaining. `+` icon button to record payment, pencil icon to adjust. Expandable sections for individual payments (amount, method, date, who recorded, transfer credit badge) and adjustment history (before/after snapshots, reason, who adjusted).
- [x] **Manual period adjustment (C#15)**
  - Admin can edit: amountDue, totalLessons, discountAmount (error correction, dispute resolution)
  - Reason required for manual adjustments
  - On save: create PaymentPeriodAdjustment (audit trail with before/after snapshots), recalculate paymentStatus
- [x] **Student profile enhancement**: Payments section on student detail page showing all billing periods with payment history and adjustment trail. Record payment and adjust period actions available inline.

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

- [x] **Mark lesson COMPLETED**
  - Set completedAt = now
  - Snapshot activeStudentCount **(C#37)**: count active members (leaveDate IS NULL) as of lessonDate, **not** as of the moment completion is recorded
  - Status: SCHEDULED → COMPLETED

### Teacher Unavailability & Pending Resolution

- [x] **Record TeacherUnavailability** — date, optional startTime/endTime, reason
  - Overlap validation **(C#20a)**: same date, no overlapping time ranges; whole-day entry conflicts with any other on that date
  - Auto-detection **(C#28)**: find SCHEDULED lessons for that teacher on the affected date (matching time range) → set status=PENDING_RESOLUTION, pendingAt=now
- [x] **PENDING_RESOLUTION alert (C#29)**
  - Persistent visual indicator (sidebar badge or header alert, like stale trials)
  - List: lessons WHERE status = PENDING_RESOLUTION, ordered by pendingAt ASC (oldest first)
- [x] **Resolve: assign substitute**
  - Select substitute teacher (check their availability + no schedule conflicts)
  - Update lesson.teacherId → substitute
  - Swap TeacherScheduleSlot (delete original teacher's, create substitute's)
  - Status → SCHEDULED, clear pendingAt
- [x] **Resolve: cancel + append** — triggers cancellation flow below

### Cancellation & Rescheduling (C#9)

- [x] **Cancel a lesson:**
  1. Set status=CANCELLED, cancelledAt, cancelledById, cancellationReasonId (+ otherCancellationReason if isOther)
  2. Delete TeacherScheduleSlot (frees the time)
  3. Create replacement Lesson at next valid date after endDate (matching day pattern, skip holidays)
  4. Replacement: rescheduledFromId → cancelled lesson, originalLessonId → chain root (if cancelled has originalLessonId, copy it; else use cancelled lesson's own ID) — **critical for billing correctness**
  5. Create TeacherScheduleSlot for replacement
  6. Update Group.endDate to new last lesson date

### Individual Lesson Operations

- [x] **Student cancellation (C#26)**
  - Max 2 per calendar month: count CANCELLED lessons for this individual group where cancellationReasonId = "Student request"
  - Min 24h advance notice: reject if < 24h before lesson
  - Same cancel + append flow as above
  - TeacherScheduleSlot deleted (teacher IS free — student cancelled)
- [x] **Offline reschedule (C#27)**
  - Set originalDate/originalStartTime → preserve old values
  - Update lessonDate/startTime → new values
  - Swap TeacherScheduleSlot (delete old, create new)
  - Does NOT count toward cancellation limit
  - Only for INDIVIDUAL groups

### Permanent Teacher Change (C#21)

- [x] **Change a group's teacher permanently** (not a one-off substitution):
  1. Update Group.teacherId → new teacher
  2. Close current GroupTeacherHistory record (set endDate = today)
  3. Create new GroupTeacherHistory (new teacher, startDate = today, endDate = null)
  4. Update ALL future SCHEDULED lessons: set **both** teacherId AND originalTeacherId → new teacher
  5. Swap TeacherScheduleSlots for those future lessons (delete old teacher's, create new teacher's)
- [x] This also completes teacher deactivation **(C#11)**: admin can now reassign each group before deactivating

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

### Implementation Notes

**Completed in Phase 7.** All lesson operations are functional.

**New files (18):**
- `src/lib/helpers/lesson-scheduling.ts` — shared helpers: `timeToMinutes`, `timeRangesOverlap`, `findNextValidDate` (day pattern + holiday skipping)
- `src/schemas/lesson.ts` — `completeLessonSchema`, `cancelLessonSchema`, `offlineRescheduleSchema`, `assignSubstituteSchema`, `studentCancelLessonSchema`
- `src/schemas/teacher-unavailability.ts` — schema with refines for whole-day vs partial-day validation
- `src/schemas/teacher-change.ts` — `permanentTeacherChangeSchema`
- `src/lib/queries/lessons.ts` — `getLessonsForGroup`, `getPendingResolutionLessons`, `getPendingResolutionCount`, `getCancellationReasons`, `getAvailableSubstitutes`, `getTeacherUnavailability`, `getStudentCancellationCount`, `getTeachersForGroupReassignment`
- `src/lib/actions/lessons.ts` — `completeLesson`, `cancelLesson` (with internal `performCancellation`), `assignSubstitute`, `studentCancelLesson`, `offlineRescheduleLesson`, `changeGroupTeacher`
- `src/lib/actions/teacher-unavailability.ts` — `recordTeacherUnavailability` (with C#28 auto-detection), `deleteTeacherUnavailability`
- `src/app/(admin)/pending-lessons/page.tsx` — server component fetching pending lessons + substitutes
- `src/components/lessons/lesson-list.tsx` — full lesson list with upcoming/past split
- `src/components/lessons/complete-lesson-button.tsx`
- `src/components/lessons/cancel-lesson-dialog.tsx` — with reason select + other text
- `src/components/lessons/student-cancel-dialog.tsx` — shows monthly usage count
- `src/components/lessons/reschedule-dialog.tsx` — date+time picker for individual lessons
- `src/components/lessons/substitute-picker.tsx` — shows available teachers
- `src/components/lessons/pending-resolution-list.tsx` — table with actions
- `src/components/lessons/teacher-change-dialog.tsx` — permanent teacher reassignment
- `src/components/teachers/unavailability-section.tsx` — list + delete
- `src/components/teachers/unavailability-form.tsx` — whole-day / partial-day form

**Modified files (6):**
- `src/components/ui/status-badge.tsx` — added PENDING_RESOLUTION status
- `src/components/app-sidebar.tsx` — added Pending nav item with badge
- `src/app/(admin)/layout.tsx` — fetches `pendingResolutionCount` for sidebar badge
- `src/app/(admin)/groups/[id]/page.tsx` — integrated lessons list + teacher change dialog
- `src/app/(admin)/teachers/[id]/page.tsx` — integrated unavailability section
- `src/lib/actions/group-memberships.ts` — imports `timeToMinutes` from shared helper instead of local definition

**Key design decisions:**
- Cancellation uses a shared `performCancellation` internal function reused by both admin cancel and student cancel flows
- Pending resolution page is a top-level route (`/pending-lessons`) with sidebar badge for visibility (C#29)
- Teacher unavailability recording auto-detects affected lessons and sets them to PENDING_RESOLUTION in the same transaction (C#28)
- `findNextValidDate` in `lesson-scheduling.ts` is the single source of truth for computing replacement lesson dates (day pattern matching + holiday skipping)

---

## Phase 8: Attendance

**Goal:** Per-lesson attendance tracking.

### Features

- [x] **Attendance pre-creation (C#18)**: when opening attendance for a lesson, create records for all active members (leaveDate IS NULL) with isAbsent=false
- [x] **Mark absences** — toggle isAbsent per student per lesson
- [x] **Attendance view** per group — grid: lessons as columns × students as rows, showing present/absent
- [x] **Note: absences do NOT affect billing or status (C#30)** — tracking only. No freezes, no free absences for group lessons.

### Implementation Notes

- **Merged Lessons + Attendance Grid**: single `LessonGrid` component replaces both the old `LessonList` (rows=lessons) and `AttendanceGrid` (rows=students). Columns = ALL lessons, rows = students. Compact by default (just date in column headers), details on demand via click → dialog.
- Column headers color-coded by status: blue for next upcoming lesson, amber for pending resolution, greyed-out with strikethrough for cancelled, orange for past/today SCHEDULED lessons needing attention (not yet completed).
- Click column header → `LessonDetailDialog` shows lesson info + context-appropriate actions (Take Attendance, Complete, Cancel, Reschedule, Student Cancel). Sub-dialogs reuse existing controlled dialog components.
- **Attendance → Complete flow**: attendance must be taken before completing a lesson. `completeLesson` server action checks for attendance records and returns error if none exist. Complete button only appears in dialog when `hasAttendance` is true.
- On-demand attendance pre-creation: admin clicks "Take Attendance" in lesson detail dialog → creates records for all active members. Idempotent. Works on SCHEDULED (today/past) and COMPLETED lessons.
- Per-cell toggle using `useTransition` pattern — immediate persistence, no dialog needed. ✓ for present, "A" for absent.
- Sticky first column (student name) with horizontal scroll for wide grids. Auto-scrolls to next upcoming lesson on mount.
- Summary row shows absent count per lesson (only for lessons with attendance initialized).
- All 5 lesson action dialogs refactored to controlled mode (accept `open`/`onOpenChange` props, no built-in trigger buttons).
- **Serialization**: `getLessonAttendanceStatus` returns `string[]` (not `Set<string>`) since Sets don't survive Next.js server→client serialization. The grid rebuilds a `Set` on the client side. Dates also need `new Date()` wrapping in client components.

### Files

```
src/schemas/attendance.ts
src/lib/queries/attendance.ts
src/lib/actions/attendance.ts
src/lib/actions/lessons.ts (added attendance prerequisite check to completeLesson)
src/components/lessons/lesson-grid.tsx (merged view — replaces LessonList + AttendanceGrid)
src/components/lessons/lesson-detail-dialog.tsx (lesson info + actions dialog)
src/components/lessons/cancel-lesson-dialog.tsx (refactored to controlled)
src/components/lessons/reschedule-dialog.tsx (refactored to controlled)
src/components/lessons/student-cancel-dialog.tsx (refactored to controlled)
src/components/lessons/complete-lesson-button.tsx (refactored to controlled, renamed export to CompleteLessonDialog)
src/components/lessons/substitute-picker.tsx (refactored to controlled)
src/components/lessons/pending-resolution-list.tsx (updated for controlled dialog APIs)
src/app/(admin)/groups/[id]/page.tsx (uses LessonGrid, derives activeMembers)
src/app/(admin)/layout.tsx (added min-w-0 to main for horizontal scroll)
```

---

## Phase 9: Student Transfers ✅

**Goal:** Move students between groups with correct billing adjustments.

### Features

- [x] **Transfer student action — single transaction:**
  1. Set leaveDate on source GroupMembership + transferReasonId (+ otherTransferReason if isOther)
  2. **Per-membership leave billing — source group (C#31):**
     - a) Current month: reduce totalLessons to lessons up to leaveDate, recalculate amountDue, create PaymentPeriodAdjustment
     - b) Future months: hard-delete billing periods (they're untouched — UNPAID, no payments/adjustments/promotions)
     - c) Recalculate paymentStatus on current period
  3. Create new GroupMembership in destination group (triggers C#32: billing period pre-creation)
  4. **Transfer credit (C#25)**: if overpayment on source (amountPaid > amountDue - discountAmount), spill credit across destination periods (fill first, carry remainder to next). If credit exceeds all destination periods, auto-create Refund with status=PENDING for the remainder.
  5. Student status stays ACTIVE — transfer ≠ leaving
  6. Set previousMembershipId on new membership → old membership (traceability)
- [x] **Transfer UI** — from Group Details page
  - Select destination group with search, shows available seats, full groups greyed out
  - Select transfer reason (from TransferReason table)
  - Preview billing impact before confirming (old period adjusted, credit transferred, new periods created)
- [ ] **Student profile**: show transfer/group history (via previousMembershipId chain and leaveDate/transferReason) — deferred to Phase 14

### Shared Helpers

- [x] `src/lib/helpers/leave-billing.ts` — per-membership leave billing logic. Reused for merge (Phase 11) and dropout (Phase 2 deactivation enhancement).
- [x] `src/lib/helpers/lesson-scheduling.ts` — extracted `checkScheduleConflicts()` from inline code in `addStudentsToGroup`. Used by both add-student and transfer flows.

### Implementation Notes

- Transfer date is always today (no backdating)
- Billing preview fetched via server action wrapper (`getTransferBillingPreview`) around read-only query
- Schedule conflict check excludes source group (student is leaving it)
- Language enforcement applies for BEGINNER/ELEMENTARY level transfers
- Validations: capacity, duplicate membership, schedule conflict, language, isOther reason text
- Transfer dialog is a single component (no separate group-picker/billing-preview — kept simple)
- Transfer credit spills over across destination periods (not dumped on first period). Residual credit beyond all periods creates a PENDING Refund.
- Leave billing lesson count respects student joinDate (not start of month)
- Fixed pre-existing TS narrowing issues in `add-student-dialog.tsx` and `assign-dialog.tsx` (changed `result?.error` to `"error" in result`)

### Files

```
New:
src/lib/helpers/leave-billing.ts          — C#31 leave billing (reused by Phase 11)
src/lib/actions/transfers.ts              — transferStudent action + billing preview wrapper
src/schemas/transfer.ts                   — Zod validation
src/lib/queries/transfers.ts              — transfer reasons, eligible groups, billing preview
src/components/transfers/transfer-dialog.tsx — full transfer UI (group picker + reason + billing preview)

Modified:
src/lib/helpers/lesson-scheduling.ts      — extracted checkScheduleConflicts
src/lib/actions/group-memberships.ts      — uses extracted schedule conflict helper
src/components/groups/student-list.tsx     — added Transfer button for active non-trial members
src/app/(admin)/groups/[id]/page.tsx      — fetches transfer data, passes to StudentList
src/components/groups/add-student-dialog.tsx — fixed TS narrowing (result?.error → "error" in result)
src/components/reception/assign-dialog.tsx  — fixed TS narrowing (result?.error → "error" in result)
```

---

## Phase 10: Teacher Payments

**Goal:** Monthly teacher pay generation and tracking.

### Features

- [x] **Generate teacher pay for a month:**
  - For each teacher, for each group they taught in that month:
    - Count completed lessons WHERE teacherId = teacher AND lessonDate in month
    - Sum activeStudentCount across those lessons → totalStudentLessons
    - Look up rate from TeacherRateChange: most recent WHERE effectiveFrom <= first day of month, using Group.type to select groupLessonRate vs individualLessonRate **(C#14)**
    - amount = totalStudentLessons × rate
  - Create TeacherPaymentPeriod records
  - Substitute handling: counts for whoever actually taught (teacherId, not originalTeacherId)
- [x] **Teacher pay list** — table: teacher, group, period, lessons completed, student-lessons, rate, amount, status
- [x] **Mark as paid** — set status=PAID, paidAt (individual + batch mark-all-paid)
- [x] **Teacher profile enhancement**: add pay history section

### Implementation Notes

- **Month selector**: URL-based navigation via searchParams (`?year=2026&month=2`), defaults to previous month
- **Bulk generation**: `createMany` with `skipDuplicates: true` — safe to re-run, fills gaps
- **Rate snapshot**: captured at generation time from `TeacherRateChange` (most recent where `effectiveFrom <= periodStart`), immutable after creation
- **Skip zero-amount**: teachers with no completed lessons or zero student count are not included
- **Validation**: cannot generate for months that haven't ended yet
- **Batch mark-as-paid**: `updateMany` where `periodYear, periodMonth, status = 'UNPAID'`
- **Summary cards**: total/paid/unpaid amounts and record counts

### Files

```
src/schemas/teacher-payment.ts                          — Zod schemas
src/lib/queries/teacher-payments.ts                     — read-only queries
src/lib/actions/teacher-payments.ts                     — generate + mark-paid actions
src/app/(admin)/teacher-payments/page.tsx                — Teacher Payments page
src/components/teacher-payments/teacher-pay-table.tsx    — TanStack data table
src/components/teacher-payments/generate-pay-dialog.tsx  — generation confirmation dialog
src/components/teacher-payments/month-selector.tsx       — month navigation
src/components/teacher-payments/pay-summary-cards.tsx    — summary stats cards
src/components/app-sidebar.tsx                           — added Teacher Pay nav item
src/app/(admin)/teachers/[id]/page.tsx                   — added payment history section
```

---

## Phase 11: Group Lifecycle (Merge & Graduation)

**Goal:** End-of-life group operations — merging small groups and graduating to next level.

### Group Merge (C#10, C#22)

- [x] **Merge group A into group B:**
  1. Validate: A and B are compatible (same level, B has capacity for A's students)
  2. Set A.mergedIntoGroupId = B.id, A.isActive = false
  3. Set leaveDate on all A's active memberships → triggers per-membership leave billing **(C#31)**: overpayment becomes transfer credit on B (not a refund)
  4. Create new memberships in B with previousMembershipId → triggers billing period pre-creation **(C#32)**
  5. Works for both GROUP and INDIVIDUAL types **(C#22)**
- [x] **Merge UI**: select surviving group, preview student movements and billing impact, confirm

### Group Graduation (C#23, C#24, C#33)

- [x] **Graduation workflow:**
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
- [x] **Edge cases:**
  - Students who don't continue: admin must pick one of two outcomes per student (no one left in limbo):
    - **"Send to reassignment"** → status set to `AWAITING_REASSIGNMENT` → appears on Reassignment page for re-placement (Phase 15)
    - **"Deactivate"** → status set to `INACTIVE` with lostReason → appears in lost list
  - Students who fail mid or final exam: removed from group → status set to `AWAITING_REASSIGNMENT` → their level+stage stays as-is (e.g. "Beginner Final" stays "Beginner Final", student does NOT restart the level) → admin assigns to a new group at the same level+stage from Reassignment page
  - mergedIntoGroupId and graduatedIntoGroupId are mutually exclusive (Zod validation)
  - **Pending refund from prior transfer:** If a student continuing to the new group has a PENDING Refund (from a transfer where credit exceeded destination periods), the refund is NOT auto-carried forward. Admin resolves it manually via refund UI: either "Convert to credit" (cancel refund, apply as transfer credit to new group's billing) or "Process refund" (return the money).
- [x] **Graduation UI**: show student selection (continuing vs leaving vs deactivating), preview new group details, confirm. Force a decision for every non-continuing student.
- [x] **Refund management UI** — list PENDING refunds, "Process refund" action (record completion), "Convert to credit" action (cancel refund, create transfer credit on a specified billing period). Needed by Phase 9 (transfer residual credit), Phase 11 (graduation with pending refund), and future dropout flow.

### Shared Helpers

- [x] `src/lib/helpers/transfer-credit.ts` — extracted credit spillover logic from `transfers.ts` into reusable `applyTransferCredit()`. Used by merge and refund-conversion.
- [x] `src/lib/helpers/level-progression.ts` — `getNextLevel()` and `canGraduate()` eligibility check.
- [x] Refactored `src/lib/actions/transfers.ts` to use `applyTransferCredit()` helper.

### Implementation Notes

- **Schema migration:** added `AWAITING_REASSIGNMENT` to `StudentStatus` enum (between `AWAITING_ASSIGNMENT` and `ACTIVE`). Migration: `20260319120000_add_awaiting_reassignment_status`.
- **Merge dialog:** modeled on transfer dialog pattern. Searchable group picker (same-level only), async billing preview per student, destructive confirmation with checkbox.
- **Graduation dialog:** `max-w-2xl` with async preview. Sections: new group preview, student decision table (Continue/Reassign/Deactivate per student), pending refund warning, summary footer.
- **Graduation does NOT call `performLeaveBilling`:** all lessons are already COMPLETED/CANCELLED, billing periods are finalized. `leaveDate` is set purely for record-keeping.
- **Refund management:** standalone `/refunds` page with DataTable. Two actions per pending refund: Process (record payment) and Convert to Credit (apply to unpaid period). Sidebar badge shows pending count.

### Files

```
New:
src/lib/helpers/transfer-credit.ts          — shared credit spillover logic
src/lib/helpers/level-progression.ts        — level ordering + graduation eligibility
src/lib/queries/group-merge.ts              — merge groups query + billing preview
src/lib/queries/group-graduation.ts         — graduation preview data
src/lib/queries/refunds.ts                  — refund queries + count
src/schemas/group-merge.ts                  — merge validation
src/schemas/group-graduation.ts             — graduation validation with student decisions
src/schemas/refund.ts                       — refund processing schemas
src/lib/actions/group-merge.ts              — merge action
src/lib/actions/group-graduation.ts         — graduation action
src/lib/actions/refunds.ts                  — process/convert refund actions
src/components/groups/merge-dialog.tsx       — merge dialog
src/components/groups/graduation-dialog.tsx  — graduation dialog
src/components/refunds/refund-table.tsx      — refund TanStack table
src/components/refunds/process-refund-dialog.tsx  — process refund dialog
src/components/refunds/convert-to-credit-dialog.tsx — convert to credit dialog
src/app/(admin)/refunds/page.tsx             — refunds page

Modified:
packages/database/prisma/schema.prisma       — added AWAITING_REASSIGNMENT
src/lib/actions/transfers.ts                 — refactored to use applyTransferCredit helper
src/components/ui/status-badge.tsx           — added AWAITING_REASSIGNMENT + refund status maps
src/app/(admin)/groups/[id]/page.tsx         — added Merge + Graduation dialogs + data fetching
src/components/app-sidebar.tsx               — added Refunds nav item with badge
src/app/(admin)/layout.tsx                   — fetch pending refund count
src/lib/queries/students.ts                  — added LostReason type export
```

---

## Phase 12: Promotions & Referrals

**Goal:** Discount management and referral tracking.

### Promotions

- [x] **Promotion CRUD**
  - Fields: name, type, discountType, discountPercent or discountAmount (exactly one — Zod XOR), levels[], groupTypes[], isRecurring, recurringMonths, maxUsesPerStudent, maxUsesTotal, validityDays, validFrom/validTo, code, isActive
- [x] **Assign promotion to student** — create StudentPromotion, calculate expiresAt from validityDays
- [x] **Apply promotions during billing** (new `applyPromotionsToPeriods` helper):
  - Query active StudentPromotions
  - Calculate discount per period, create AppliedPromotion records
  - Clamp total discountAmount to amountDue **(C#36)** — a student never pays less than zero
  - For recurring: increment monthsUsed, check recurringMonths / expiresAt
- [x] **First-lesson discount for trial commits** — when a trial student commits, auto-create a TRIAL StudentPromotion, then `applyPromotionsToPeriods()` applies 50% to first billing period.
- [x] **Promotion list** — usage count, active/inactive toggle

### Referrals

- [x] **Record referral**: referrer → referred student, using referralCode
  - Validate: no self-referral (Zod), each student can only be referred once (referredStudentId @unique)
- [x] **Referral completion**: when referred student makes first payment → status=COMPLETED, completedAt
  - Create StudentPromotions for both referrer (billing credit) and referred (first-month discount)

### Implementation Notes

- **Billing integration pattern**: `buildPaymentPeriods()` unchanged (still sets `discountAmount: 0`). New `applyPromotionsToPeriods()` helper runs after `createMany` within the same transaction — queries eligible StudentPromotions, calculates discounts, creates `AppliedPromotion` records, updates `discountAmount` + `paymentStatus` on each period.
- **Wired into all period-creation flows**: `addStudentsToGroup`, `resolveTrialMembership` (trial commit), `transferStudent`, `mergeGroup`, `graduateGroup`.
- **Referral completion**: `recordPayment` converted from batched to interactive transaction. After recording payment, checks if student has a PENDING referral and this is their first real (non-transfer-credit) payment.
- **Referral codes**: Auto-generated (8 char alphanumeric) on student creation.
- **Form schema pattern**: `promotionBaseSchema` (no refine/preprocess) for react-hook-form, `promotionSchema` (with XOR refine) for server actions — avoids zodResolver type issues with `z.preprocess`.

### Files

```
New:
src/schemas/promotion.ts                          — promotion + assign + referral schemas
src/lib/helpers/promotions.ts                     — applyPromotionsToPeriods() core discount logic
src/lib/queries/promotions.ts                     — promotion + student promotion queries
src/lib/queries/referrals.ts                      — student referral queries
src/lib/actions/promotions.ts                     — promotion CRUD + assign actions
src/lib/actions/referrals.ts                      — record referral action
src/app/(admin)/promotions/page.tsx               — promotions list page
src/app/(admin)/promotions/new/page.tsx           — create promotion page
src/app/(admin)/promotions/[id]/edit/page.tsx     — edit promotion page
src/components/promotions/promotion-table.tsx      — TanStack DataTable for promotions
src/components/promotions/promotion-form.tsx       — promotion create/edit form
src/components/promotions/assign-dialog.tsx        — assign promotion to student dialog

Modified:
src/components/app-sidebar.tsx                     — added Promotions nav item (Tag icon)
src/lib/actions/group-memberships.ts              — wired applyPromotionsToPeriods + trial discount
src/lib/actions/transfers.ts                       — wired applyPromotionsToPeriods
src/lib/actions/group-merge.ts                    — wired applyPromotionsToPeriods
src/lib/actions/group-graduation.ts               — wired applyPromotionsToPeriods
src/lib/actions/payments.ts                       — referral completion in recordPayment
src/lib/actions/students.ts                       — auto-generate referralCode on create
src/app/(admin)/students/[id]/page.tsx            — added promotions + referrals sections
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

## Phase 14: Trial Tracking & Enforcement

**Goal:** Full trial lifecycle tracking per teacher — who had trials, when, in which group, what was the outcome. Enforce one trial per student. Accurate teacher attribution including substitutions.

**Depends on:** Phase 7 (substitution tracking), Phase 8 (attendance — who actually taught the trial student), Phase 12 (promotions — first-lesson discount on trial commit).

### Schema Changes

- [ ] **Add `wasTrialOriginally Boolean @default(false)` to GroupMembership**
  - Set `true` when `isTrial=true` at creation time. Never changes after that.
  - Enables querying committed trials (wasTrialOriginally=true, isTrial=false) which are currently indistinguishable from non-trial memberships.

- [ ] **Add `trialTeacherId` (optional FK → Teacher) to GroupMembership**
  - Snapshot of `group.teacherId` at the time of trial join. Preserved even if the group's teacher changes later.
  - For accurate attribution after Phase 7 substitutions: cross-reference with `Lesson.teacherId` + attendance records to determine who actually taught the trial lesson. `trialTeacherId` is the fallback/default.

- [ ] **One-trial-per-student constraint (C#38)**
  - **Reception assignments are always trials** — every student assigned from Reception is a new student who has never been in a group, so their first assignment is inherently a trial. No checkbox needed; `isTrial=true` is set automatically.
  - **Reassignment page assignments are never trials** — students on the Reassignment page have already been in a group (and likely already had their trial). `isTrial` is not offered.
  - **Add-student from Group Details**: disable trial checkbox if student has an **attended** trial (see no-show handling below). Tooltip: "Student has already used their trial lesson".
  - Application-level: in `addStudentsToGroup`, if `isTrial=true`, check if student has any existing membership where `wasTrialOriginally=true` AND has at least one attendance record → reject with "Student has already used their trial lesson"
  - DB-level: no partial unique index (multiple trial memberships are valid for no-shows). Constraint enforced at application level only.

- [ ] **Trial no-show handling**
  - A trial with zero attendance records = no-show. The student didn't actually take a trial lesson.
  - No-show trials do NOT count toward the one-trial limit — student can be re-assigned from Reception for another trial.
  - The constraint checks: "student has a trial membership (`wasTrialOriginally=true`) **with at least one attendance record**" — not just "trial membership exists".
  - Multiple no-show trial memberships may exist for the same student (each is a separate GroupMembership record, possibly even in the same group).
  - Admin can view no-show history on student detail page and decide whether to give another chance or deactivate the student.

### Trial Status Derivation

From `GroupMembership` fields + attendance records, derive trial status:
- **Pending**: `isTrial=true AND leaveDate IS NULL` — student is currently in trial
- **Committed**: `wasTrialOriginally=true AND isTrial=false AND leaveDate IS NULL` — trial student who committed to the group
- **Didn't continue**: `wasTrialOriginally=true AND isTrial=true AND leaveDate IS NOT NULL AND has attendance records` — trial student who attended but left without committing
- **No-show**: `wasTrialOriginally=true AND leaveDate IS NOT NULL AND zero attendance records` — trial student who never showed up (does NOT count toward one-trial limit)

### Teacher Detail — Trial History

- [ ] **Trial stats summary**: "X committed · Y pending · Z didn't continue"
- [ ] **Trial history table**: student name, group (publicId), trial date (joinDate), status (pending/committed/didn't continue), actual teaching teacher (from attendance records if available, fallback to trialTeacherId)
- [ ] **Accurate teacher attribution**: after Phase 8, use attendance records to determine if a substitute taught the trial lesson. Display substitute name if different from group teacher.

### Trial Billing

Two billing paths depending on trial outcome:

- [ ] **Student commits** (trial → regular):
  - Billing periods created from original joinDate (existing Phase 3 logic)
  - Promotions system (Phase 12) applies a 50% discount on the first lesson's billing period
  - Phase 14 ensures the trial data (`wasTrialOriginally`, commit date) is available for the promotion to reference

- [ ] **Student doesn't commit** (trial → removed):
  - On trial removal (`resolveTrialMembership` with action="remove"): create a single `StudentPaymentPeriod` for the trial lesson(s) attended
  - amountDue = number of lessons attended during trial × pricePerLesson (full price, no discount)
  - paymentStatus = UNPAID → student appears in **No Payment List** (Phase 6) so admin can collect payment
  - This ensures no trial lesson goes unbilled — the student owes for the lesson(s) they attended regardless of whether they continue

- [ ] **No-show** (trial → removed, zero attendance):
  - No billing created — student didn't attend any lessons, nothing to charge
  - Trial does NOT count toward one-trial limit — student can be re-assigned from Reception for another trial
  - Multiple no-shows are tracked as separate GroupMembership records (visible on student detail page)

### Files

```
packages/database/prisma/schema.prisma              — wasTrialOriginally, trialTeacherId on GroupMembership
packages/database/prisma/migrations/data_integrity_constraints.sql — one-trial-per-student partial unique index
apps/admin/src/lib/queries/teachers.ts               — trial history query with student/group details
apps/admin/src/lib/actions/group-memberships.ts      — one-trial check, set wasTrialOriginally + trialTeacherId
apps/admin/src/app/(admin)/teachers/[id]/page.tsx    — trial history section
```

---

## Phase 15: Reassignment & Orphan Detection

**Goal:** A dedicated holding area for students who were previously in a group and need re-placement — separate from Reception (which is for brand-new students from amoCRM). Handles exam failures, graduation non-continuation, returning inactive students, and orphaned students.

**Depends on:** Phase 11 (graduation is a key trigger), but the schema change (`AWAITING_REASSIGNMENT` status) and basic page can be implemented earlier.

### Key Decisions

- **Reception = new students only.** Every student assigned from Reception is taking a trial lesson (implicit, no checkbox). They've never been in a group before.
- **Reassignment = returning students only.** Students who were previously in a group and need a new one. No trial option — they've already had one (or had the chance).
- **Two separate lists, same assign dialog.** Both pages reuse the assign dialog for group assignment, but Reception auto-sets `isTrial=true` and Reassignment does not.

### Schema Change

- [ ] **Add `AWAITING_REASSIGNMENT` to `StudentStatus` enum**
  - New lifecycle: `ACTIVE` → `AWAITING_REASSIGNMENT` → `ACTIVE` (re-assigned to new group)
  - Also: `INACTIVE` → `AWAITING_REASSIGNMENT` (returning students)
  - Student's level+stage is preserved — admin knows exactly where to place them

### Triggers (how students enter reassignment)

- [ ] **Exam failure** — student fails mid or final exam → removed from group → status set to `AWAITING_REASSIGNMENT`. Level+stage stays as-is (e.g. "Beginner Final" stays "Beginner Final" — student does NOT restart the level).
- [ ] **Graduation without continuation** — during Phase 11 graduation workflow, admin picks "Send to reassignment" for non-continuing students → `AWAITING_REASSIGNMENT`.
- [ ] **"Send to reassignment" action** — available on any ACTIVE or INACTIVE student detail page. Sets status to `AWAITING_REASSIGNMENT`. Covers:
  - Returning students (INACTIVE → AWAITING_REASSIGNMENT)
  - Orphaned students (ACTIVE with no active membership → AWAITING_REASSIGNMENT)
  - Manual removals from groups

### Orphan Detection (safety net)

- [ ] **Detect ACTIVE students with zero active memberships** (leaveDate IS NULL on all memberships, or no memberships at all). These are students who slipped through — removed manually, edge cases, etc.
  - Show as a warning section at the top of the Reassignment page (or as a sidebar badge)
  - Admin can review and either send to reassignment or deactivate

### Reassignment Page (`/reassignment`)

- [ ] **Sidebar nav item** — between Reception and Uncertain, with count badge
- [ ] **Table columns:** CRM, name, phone, level+stage, previous group (last active membership's group), reason (exam failure / graduation / returning / manual), date entered reassignment
- [ ] **Assign action** — reuses the same assign dialog as Reception, but without trial option
- [ ] **Deactivate action** — if student is no longer interested, deactivate with lostReason → student moves to **Lost List** (Phase 16) for win-back follow-up

### Cross-references with Lost List (Phase 16)

- **Reassignment → Lost List:** "Deactivate" action on Reassignment page sets student to INACTIVE with lostReason → appears in Lost List for win-back scripts.
- **Lost List → Reassignment:** "Send to reassignment" action on Lost List (or student detail page) sets INACTIVE → AWAITING_REASSIGNMENT → appears on Reassignment page.
- **Graduation → Lost List:** "Deactivate" option during graduation (Phase 11) sends student directly to Lost List.
- Students can move between Lost List and Reassignment multiple times (e.g., won back from Lost List → reassigned → leaves again → Lost List).

### Files

```
packages/database/prisma/schema.prisma              — add AWAITING_REASSIGNMENT to StudentStatus
apps/admin/src/lib/queries/reassignment.ts           — query AWAITING_REASSIGNMENT students
apps/admin/src/lib/actions/students.ts               — sendToReassignment action
apps/admin/src/app/(admin)/reassignment/page.tsx     — server component page
apps/admin/src/components/reassignment/reassignment-table.tsx — client component table
apps/admin/src/components/app-sidebar.tsx             — add Reassignment nav item
apps/admin/src/app/(admin)/layout.tsx                — fetch reassignment count
```

---

## Phase 16: Lost List & Win-Back

**Goal:** A dedicated page for INACTIVE students — students who left the school. Admins follow specific scripts to win these students back. Separate from Reassignment (which is for students who need re-placement but haven't left).

**Depends on:** Phase 2 (student deactivation already exists). Independent of most other phases — can be implemented early.

### Lost Page (`/lost`)

- [ ] **Sidebar nav item** — with count badge showing total inactive students
- [ ] **Table columns:** CRM, name, phone, level+stage, lost reason, deactivation date, deactivated by, last group (from most recent membership), time since deactivation
- [ ] **Search/filter:** by name, phone, lost reason, level
- [ ] **"Assign to group" action** — opens the assign dialog directly from the Lost List. Student goes INACTIVE → ACTIVE (no trial). For when admin knows which group to place the student in right away.
- [ ] **"Send to reassignment" action** — INACTIVE → AWAITING_REASSIGNMENT → student appears on Reassignment page (Phase 15). For when the student wants to return but the group hasn't been decided yet.
- [ ] **Contact info:** phone prominently displayed for admin to call/message as part of win-back scripts
- [ ] **Notes/history:** admin can view student detail (existing page) for full history — groups attended, duration, comments

### Win-Back Flow

```
Student deactivated (lostReason set)
  → Appears in Lost List
  → Admin follows win-back script (call/message)
  → Student wants to return:
    Option A: Admin knows the group → "Assign to group" → INACTIVE → ACTIVE (direct)
    Option B: Group TBD → "Send to reassignment" → AWAITING_REASSIGNMENT → Reassignment page (Phase 15) → assign → ACTIVE
```

### Files

```
apps/admin/src/lib/queries/lost.ts                  — query INACTIVE students with last group info
apps/admin/src/app/(admin)/lost/page.tsx             — server component page
apps/admin/src/components/lost/lost-table.tsx         — client component table
apps/admin/src/components/app-sidebar.tsx             — add Lost nav item
apps/admin/src/app/(admin)/layout.tsx                — fetch lost count
```

---

## Phase 17: Scenario Testing

**Goal:** Validate the entire system end-to-end by walking through realistic operational scenarios in the live admin panel, catching edge cases that unit tests and per-phase development miss.

### Approach

Claude generates real-life scenarios based on the business rules, constraints, and domain knowledge from `DATA_MODEL.md`, `admin-panel-plan.md`, and `ISSUES.md`. We execute each scenario manually in the admin panel. If something breaks or behaves unexpectedly, we fix it before moving on.

### Scenario categories

- [ ] **Happy paths** — a full student lifecycle from reception to graduation (enroll, assign to group, pay, attend, transfer, graduate)
- [ ] **Billing edge cases** — mid-month joins, transfers with overpayment credit, partial periods, price changes between months
- [ ] **Scheduling conflicts** — teacher unavailability on a lesson day, double-booking attempts, holiday collisions, cancel+append chains
- [ ] **Group lifecycle** — merge two groups with overlapping students, graduate a group where some students don't continue, merge then graduate
- [ ] **Constraint enforcement** — try to violate each of the 37 constraints and verify the system blocks it with a clear message
- [ ] **Concurrent operations** — transfer a student while recording a payment for them, deactivate a teacher who has a pending resolution lesson
- [ ] **Data integrity** — after each scenario, verify DB state is consistent (no orphaned billing periods, no dangling schedule slots, correct payment statuses)

---

## Phase 18: Promotion Auto-Detection & Application Rules

**Goal:** Define and implement auto-detection logic for each promotion type, specifying when promotions are automatically assigned to students and which payment periods they apply to. Currently all promotions except TRIAL are manually assigned.

### Scope

- [ ] **FAMILY** — auto-detect when 2+ students share a `Family`, auto-assign to all family members
- [ ] **LOYALTY** — define criteria (e.g., N consecutive months paid on time), auto-assign
- [ ] **WIN_BACK** — auto-assign when a previously inactive student is reactivated
- [ ] **EARLY_PAYMENT** — auto-detect when payment is recorded before period start date
- [ ] **SEASONAL / PARTNER / OTHER** — remain manual (admin-assigned campaigns)
- [ ] **Application timing** — define exactly which payment periods each promotion type targets (current period only, next period, all future periods, etc.)
- [ ] **Stacking rules** — clarify how multiple auto-detected promotions interact (additive vs best-one-wins)

### Notes

- Phase 12 built the promotion infrastructure (CRUD, `applyPromotionsToPeriods()`, `StudentPromotion`, `AppliedPromotion`). This phase adds the trigger logic.
- TRIAL auto-detection already works (created on trial commit in `resolveTrialMembership`).
- Referral reward auto-detection already works (created on first payment in `recordPayment`).

---

## Pre-Launch Cleanup

Tasks to complete before deploying to production.

- [ ] **Remove dev auth bypass** — Delete `DEV_BYPASS_AUTH` blocks (marked with `TODO: remove before prod`) from `src/lib/auth.ts`, `src/middleware.ts`, and `apps/admin/.env`. Search for `TODO: remove before prod` to find all locations.

---

## Later Scope

Not in the initial build. Tracked here so nothing is forgotten.

- [x] **Uncertain List** — `/uncertain` page showing ACTIVE students with `isUncertain=true`. Table with CRM, name, phone, level, group, flaggedBy, comment. Sidebar badge shows count. Auto-criteria (3+ absences, 3+ incomplete homework) deferred until attendance tracking (Phase 8).
- [ ] **Exam List** — Exam model exists, needs management UI per group
- [ ] **Payment List** — financial reporting: filter by year/month/teacher/group, teacher salary overview
- [ ] **amoCRM integration** — API polling for leads in "Ready for Group" stage → auto-create student records
- [ ] **Zoom integration** — auto-create meetings per group (see `tech/zoom-integration-plan.md`)
- [ ] **Analytics dashboard** — student counts, revenue, utilization, homework completion
- [ ] **Bulk student actions** — mass payment recording, mass SMS, mass transfer
- [ ] **Content management** — deferred, teachers use physical textbooks
- [ ] **Payment gateway integration** — Click, Payme (currently manual recording only)
- [ ] **Teacher file uploads** — contract and passport document storage per teacher. Requires file storage infrastructure (S3/Cloudflare R2), upload API endpoints, file management UI on teacher detail page. Add `TeacherDocument` model (teacherId, type: CONTRACT/PASSPORT/OTHER, fileName, fileUrl, uploadedAt, uploadedById). Display as a list on teacher detail page with upload/download/delete actions.


---

## Revisit

Decisions to revisit with co-founder before finalizing.

- **Offline reschedule (C#27)** — Currently implemented: when student and teacher privately agree to move an individual lesson to a different time, admin records the change in the system (updates date/time, swaps teacher schedule slot). **Question: is this needed?** If admin doesn't record it, the schedule view shows the lesson at the original time and conflict detection doesn't know about the real time — could allow double-booking the teacher. For individual lessons this is low-risk since teachers manage their own schedule. If we decide it's not needed, hide the "Offline Reschedule" button (code stays, just not exposed).
- **Offline reschedule scope** — C#27 says "Not applicable to group lessons", but in practice offline reschedules happen for both group and individual lessons. Currently the button only shows for individual groups. Revisit whether to allow for both group types.

---

## Constraint Coverage

Every one of DATA_MODEL.md's 40 application-level constraints, mapped to a phase.

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
| 15 | StudentPaymentPeriod manual editing | 6 | [x] |
| 16 | paymentStatus sync helper | 6 | [x] |
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
| 36 | Discount cap (discountAmount ≤ amountDue) | 3, 12 | [x] |
| 37 | activeStudentCount snapshot timing | 7 | [ ] |
| 38 | One trial per student (attended trial, not just membership) | 14 | [ ] |
| 39 | No student left in limbo (graduation forces decision for every non-continuing student) | 15 | [ ] |
| 40 | Student schedule conflict detection (block overlapping group times on add) | 3 | [x] |

### DB-Level Constraints (already applied via migration)

These live in `prisma/migrations/data_integrity_constraints.sql` — not app-level, but verify they exist:

| Constraint | What |
|-----------|------|
| `active_membership_unique` | Partial unique index: one active membership (leaveDate IS NULL) per student per group |
| `student_crm_code_trigger` | BEFORE INSERT: computes crmCode from sequenceNumber |
| `group_public_id_trigger` | BEFORE INSERT: computes publicId (GR-N / IND-N) from type + sequenceNumber |
| `current_group_teacher_unique` | Partial unique index: one current teacher (endDate IS NULL) per group in GroupTeacherHistory |
