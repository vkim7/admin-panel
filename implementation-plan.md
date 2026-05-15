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
| 17 | Promotion Auto-Detection & Application Rules | 12 | — |
| 18 | Scenario Testing | All | All |
| **Feedback Phases** | | | |
| A | Bug Fixes & Broken Behavior ✅ | Post-launch | feedback.md #6,8,19,20,22,32 |
| B | Trial Resolution Overhaul ✅ | A | feedback.md #13,14,15 |
| C | Payment Controls & Visibility ✅ | B | feedback.md #16,17,21 |
| D | Small UI Polish ✅ | C | feedback.md #4,5,9,11,23,30 |
| E | Reception Workflow ✅ | D | feedback.md #1,2,3 |
| F | Teacher Management ✅ | D | feedback.md #10,12,18 |
| G | Uncertain Students ✅ | D | feedback.md #24,25 |
| H | Promotions, Comments & Constraints ✅ | D | feedback.md #7,28,33 |
| I | Exams & Scheduling ✅ | D | feedback.md #29 |
| J | Scheduled Actions (Effective Date) ✅ | I | feedback.md #26 |
| K | Holidays Management ✅ | D | feedback.md #31 |
| L | Test Suite Revisit | All | — |

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

                                   Phase 12 ──── Phase 17 (Promotion Auto-Detection)

                                   All phases ──── Phase 18 (Scenario Testing)
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
  - preferredLanguage is required for all students — no default value, admin must explicitly select. Language mismatch triggers a warning (all levels) — admin can still proceed.
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
  - **Language mismatch**: shown as a warning indicator on incompatible groups (all levels) — admin can still assign. Not a blocker.
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
- [x] **Sidebar "Admin Panel" title**: clicking redirects to /schedule (the primary operational view)

### Files

```
src/lib/queries/reception.ts                   ← getReceptionStudents, getReceptionCount, getGroupsForAssignment
src/app/(admin)/reception/page.tsx             ← rewritten from placeholder
src/components/reception/reception-table.tsx
src/components/reception/assign-dialog.tsx
```

Also modified: `app-sidebar.tsx` (badge prop, "Admin Panel" links to /schedule), `layout.tsx` (fetches reception count), `actions/group-memberships.ts` (revalidate /reception, language mismatch warning, trial student activation), `actions/students.ts` (revalidate /reception on status changes). No separate `actions/reception.ts` needed — reuses existing `addStudentsToGroup`.

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

### Implementation Notes (Feedback Phase C)

- **Payment validation (#21):** `recordPayment` now selects `periodYear`/`periodMonth` and validates: (1) period is not in the future, (2) amount does not exceed remaining balance (`amountDue - discountAmount - amountPaid`), (3) period is not already fully paid. `record-payment-dialog.tsx` has `max={remaining}` on amount input.
- **Remaining amount (#16):** "Remaining" column added to `no-payment-table.tsx`. Group detail student list shows remaining amount in red next to status badge — required adding `discountAmount` to `paymentPeriods` select in `getGroupById` and to `MembershipRow` type in `student-list.tsx`.
- **Payment History page (#17):** New route `/payment-history` with own sidebar entry ("Payment History", `Receipt` icon). New query `getPaidPayments(year, month, method?)` filters `Payment` records by `paidAt` date range and excludes transfer credits. New `paid-payments-table.tsx` component. Month picker (last 6 months) + payment method filter pills as `<Link>` search params. Added `bank_transfer` to `recordPaymentSchema` enum, `RecordPaymentDialog` select, and `METHOD_LABEL` maps in `payment-history.tsx` and `paid-payments-table.tsx`.
- **Code review fixes:** (1) `updateStudent` — `redirect()` moved outside try/catch to avoid catching Next.js internal throw. (2) `sendToReassignment` — membership validation moved before transaction, returns `{ error }` instead of throwing. (3) `record-payment-dialog` — dialog resets amount/method/note from fresh props on open via `handleOpenChange`. (4) `payment-history` page — searchParams validated with `Number.isFinite()`, falls back to current month on garbage. (5) `reactivateStudent` — clears `isUncertain` and `uncertainComment`.

### Files

```
src/schemas/payment.ts
src/lib/queries/payments.ts                    ← + getPaidPayments query, PaidPayment type
src/lib/actions/payments.ts                    ← + future-month block, amount cap validation
src/lib/helpers/payment-status.ts              ← shared helper (C#16)
src/app/(admin)/payments/page.tsx              ← No Payment list (unchanged from Phase 6)
src/app/(admin)/payment-history/page.tsx       ← NEW: Payment History page with filters
src/components/payments/no-payment-table.tsx   ← + Remaining column
src/components/payments/record-payment-dialog.tsx  ← + max attr, Bank Transfer option
src/components/payments/paid-payments-table.tsx    ← NEW: paid payments DataTable
src/components/payments/period-editor.tsx
src/components/payments/payment-history.tsx    ← + bank_transfer in METHOD_LABEL
src/components/groups/student-list.tsx         ← + discountAmount type, remaining display
src/lib/queries/groups.ts                      ← + discountAmount in paymentPeriods select
src/components/app-sidebar.tsx                 ← + Payment History nav entry
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
- [x] **Student profile**: show transfer/group history (via previousMembershipId chain and leaveDate/transferReason) — implemented in Phase 14

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
src/components/transfers/transfer-dialog.tsx — full transfer UI (group picker + reason + billing preview). Supports controlled mode (open/onOpenChange props) for use from dropdown menus (Phase B).

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
- [x] **Refund management UI** — list PENDING refunds, "Process refund" action (record completion), "Convert to credit" action (cancel refund, create transfer credit on a specified billing period). Needed by Phase 9 (transfer residual credit), Phase 11 (graduation with pending refund), and dropout/reassignment/lost flows (Phase A expanded refund triggers to all membership closures).

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
  - Calculate discount per period greedily (TRIAL first), create AppliedPromotion records
  - Non-recurring promos that find no room in a period are deferred to the next one (not wasted)
  - Clamp each promo's discount at remaining room **(C#36)** — a student never pays less than zero
  - For recurring: increment monthsUsed, check recurringMonths / expiresAt
- [x] **First-lesson discount for trial commits** — when a trial student commits, auto-create a TRIAL StudentPromotion, then `applyPromotionsToPeriods()` applies 50% to first billing period.
- [x] **Promotion list** — usage count, active/inactive toggle

### Referrals

- [x] **Record referral**: referrer → referred student, using referralCode
  - Validate: no self-referral (Zod), each student can only be referred once (referredStudentId @unique)
- [x] **Referral welcome promo**: "Referral Welcome" StudentPromotion created immediately when referral is recorded (at student creation or via manual `recordReferral`), so the referred student gets the discount on their first billing cycle
- [x] **Referral completion**: when referred student makes first payment → status=COMPLETED, completedAt
  - Create "Referral Reward" StudentPromotion for the referrer and apply to their existing billing periods via `applyPromotionsToPeriods()`

### Implementation Notes

- **Billing integration pattern**: `buildPaymentPeriods()` unchanged (still sets `discountAmount: 0`). New `applyPromotionsToPeriods()` helper runs after `createMany` within the same transaction — queries eligible StudentPromotions, calculates discounts, creates `AppliedPromotion` records, updates `discountAmount` + `paymentStatus` on each period.
- **Wired into all period-creation flows**: `addStudentsToGroup`, `resolveTrialMembership` (trial commit), `transferStudent`, `mergeGroup`, `graduateGroup`.
- **Referral flow**: "Referral Welcome" is created immediately when the referral is recorded (in `createStudent` or `recordReferral`). "Referral Reward" for the referrer is created in `recordPayment` when the referred student makes their first real (non-transfer-credit) payment, and `applyPromotionsToPeriods()` is called for the referrer's active memberships so the reward applies to existing periods.
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

## Phase 13: Communication ⏳ DEFERRED

**Goal:** SMS payment reminders and call history logging.

> **Deferred:** Blocked on SMS vendor selection. Will be implemented after Phase 17 (or later). Proceed to Phase 14.

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

**Goal:** Full trial lifecycle tracking per teacher — who had trials, when, in which group, what was the outcome. Differentiated billing by group type. Trial attempt limits. Automatic no-show detection on lesson completion.

**Depends on:** Phase 7 (substitution tracking), Phase 8 (attendance — who actually taught the trial student), Phase 12 (promotions — first-lesson discount on trial commit).

### Schema Changes

- [x] **Add `wasTrialOriginally Boolean @default(false)` to GroupMembership**
  - Set `true` when `isTrial=true` at creation time. Never changes after that.
  - Enables querying committed trials (wasTrialOriginally=true, isTrial=false) which are currently indistinguishable from non-trial memberships.

- [x] **Add `trialTeacherId` (optional FK → Teacher) to GroupMembership**
  - Snapshot of `group.teacherId` at the time of trial join. Preserved even if the group's teacher changes later.
  - For accurate attribution after Phase 7 substitutions: cross-reference with `Lesson.teacherId` + attendance records to determine who actually taught the trial lesson. `trialTeacherId` is the fallback/default.

- [x] **Trial attempt limits per group type**
  - GROUP: 2 free trials per student. INDIVIDUAL: 1 free trial per student.
  - Application-level enforcement in `addStudentsToGroup`: count `wasTrialOriginally=true` memberships per student per group type.
  - Reception assignments are always trials (`isTrial=true` hardcoded, trial toggle removed).
  - Add-student dialog shows trial attempts remaining and disables trial checkbox when exhausted.

- [x] **Trial no-show auto-detection in `completeLesson`**
  - After lesson completion, find trial students marked absent → auto-set leaveDate, deactivate with appropriate lost reason.
  - Lost reasons: "Trial no-show (Group)", "Trial no-show — final attempt (Group)", "Trial no-show (Individual)".
  - activeStudentCount snapshot happens BEFORE no-show processing for accurate teacher pay.

### Trial Status Derivation

From `GroupMembership` fields + attendance records, derive trial status:
- **Pending**: `isTrial=true AND leaveDate IS NULL` — student is currently in trial
- **Committed**: `wasTrialOriginally=true AND isTrial=false AND leaveDate IS NULL` — trial student who committed to the group
- **Didn't continue**: `wasTrialOriginally=true AND isTrial=true AND leaveDate IS NOT NULL AND has attendance records` — trial student who attended but left without committing
- **No-show**: `wasTrialOriginally=true AND leaveDate IS NOT NULL AND zero attendance records` — trial student who never showed up

### Teacher Detail — Trial History

- [x] **Trial stats summary**: "X committed · Y pending · Z didn't continue · W no-show"
- [x] **Trial history table**: student name, group (publicId), trial date (joinDate), group type, status badge, actual teaching teacher (from attendance records, fallback to trialTeacherId)
- [x] **Accurate teacher attribution**: uses attendance records to determine if a substitute taught the trial lesson.

### Trial Billing

Two billing paths depending on trial outcome, differentiated by group type:

- [x] **Student commits** (trial → regular):
  - Billing periods created from original joinDate (existing logic)
  - GROUP: TRIAL promotion applies 100% discount on first lesson (free)
  - INDIVIDUAL: TRIAL promotion applies 50% discount on first lesson
  - Two separate TRIAL promotions seeded with `groupTypes` filter

- [x] **Student doesn't commit** (trial → "didn't continue"):
  - Resolution action renamed from "remove" to "didnt_continue"
  - GROUP: no billing — group trials are free
  - INDIVIDUAL: billing period created for attended lessons at 50% discount, then student deactivated
  - Lost reasons: "Trial — didn't continue (Group)", "Trial — didn't continue (Individual)"
  - "Didn't continue" button gated on attendance being recorded

- [x] **No-show** (auto-detected on lesson completion):
  - No billing created — student didn't attend
  - Student auto-deactivated with appropriate lost reason
  - Trial attempt still counts (no-shows DO consume attempts in this implementation)

### UI Changes

- [x] **Trial resolution dialog**: renamed "Remove" → "Didn't continue", billing preview, attendance gate
- [x] **Add-student dialog**: trial attempts display + enforcement per group type
- [x] **Reception assign dialog**: trial toggle removed, `isTrial: true` hardcoded
- [x] **Student list (group detail)**: trial status badges (Committed/Didn't continue/No-show) for past members
- [x] **Student detail page**: Group History table with trial status badges, transfer reasons, merge/graduation labels, and "Moved to" links (deferred from Phase 9)
- [x] **Teacher detail page**: trial history section with stats + table

### Implementation Notes

- Migration: `20260320120000_add_trial_tracking` — adds columns + backfill SQL
- Seed updated: two TRIAL promotions (GROUP 100%, INDIVIDUAL 50%) + 5 trial lost reasons
- `completeLesson` converted from simple update to `$transaction` for atomic no-show processing
- Deactivation in trial paths checks for other active memberships before setting INACTIVE
- `getTrialMembershipAttendance` scopes attendance queries to each membership's joinDate..leaveDate window (prevents misclassification when students re-enroll)
- Student detail Group History: added Reason column (transfer reason text, or "Merged"/"Graduated" label, or trial status badge) and "Moved to" column (link to destination group via `continuedAsMemberships` or `mergedIntoGroup`/`graduatedIntoGroup`). For "Other" transfer reasons, displays the free-text `otherTransferReason` instead of "Other".
- Transfer credit notes now use group `publicId` (e.g. "GR-1") instead of raw cuid
- Payment history: "Partial period" badge renamed to "Prorated" to avoid confusion with "Partially paid" status badge. Transfer credit payments show only the "Transfer credit" badge (no empty payment method badge).
- **Phase B additions (feedback items #14, #15):**
  - All student actions in group student list unified into dropdown menus (dots icon trigger, "Actions" column header):
    - **Non-trial (`MemberActionsMenu` in `student-list.tsx`):** Transfer / Send to Reassignment / Send to Lost list
    - **Trial with attendance (`TrialActionsMenu`):** Commit / Send to Lost list (auto-reason) / Send to Reassignment
    - **Trial no-show (`TrialActionsMenu`):** Send to Lost list (manual reason picker) / Send to Reassignment / Transfer Trial (group picker)
  - Each dropdown item opens its own confirmation/form dialog. Dialogs are self-contained within the menu components.
  - `TransferDialog` gained optional `open`/`onOpenChange` props for controlled usage from `MemberActionsMenu` (trigger hidden when controlled).
  - New `transferTrialStudent` action in `group-memberships.ts`: validates trial + active, checks capacity/duplicates/schedule conflicts, blocks if trial attempts exhausted, atomically closes source + creates new trial membership (no billing).
  - Schema: added `transferTrialSchema` to `group-membership.ts`.
  - Deleted `send-to-lost-dialog.tsx` and `transfer-trial-dialog.tsx` (functionality inlined into menu components).
  - Removed `activeTrialStudentIdsWithAttendance` prop from `StudentList` (replaced by membership-ID-based `trialMembershipIdsWithAttendance`).

### Files

```
packages/database/prisma/schema.prisma                          — wasTrialOriginally, trialTeacherId, TrialTeacher relation
packages/database/prisma/migrations/20260320120000_add_trial_tracking/ — migration with backfill
packages/database/prisma/seed.ts                                — two TRIAL promotions + 5 trial lost reasons
apps/admin/src/schemas/group-membership.ts                      — "remove" → "didnt_continue"
apps/admin/src/lib/actions/group-memberships.ts                 — trial enforcement, snapshots, updated resolution
apps/admin/src/lib/actions/lessons.ts                           — no-show auto-detection in completeLesson
apps/admin/src/lib/queries/teachers.ts                          — getTeacherTrialHistory
apps/admin/src/lib/queries/students.ts                          — getTrialAttemptsForStudents, getTrialMembershipAttendance
apps/admin/src/lib/helpers/transfer-credit.ts                   — use publicId in transfer credit notes
apps/admin/src/components/ui/trial-status-badge.tsx             — NEW: shared TrialStatusBadge + getTrialStatus helper
apps/admin/src/components/groups/trial-resolution-dialog.tsx    — rewritten as `TrialActionsMenu` (Phase B): dropdown menu with trial actions + inline dialogs
apps/admin/src/components/groups/student-list.tsx               — trial status badges for past members + `MemberActionsMenu` dropdown for non-trial + `TrialActionsMenu` for trial (Phase B)
apps/admin/src/components/groups/send-to-lost-dialog.tsx        — DELETED (Phase B): functionality inlined into menu components
apps/admin/src/components/groups/add-student-dialog.tsx         — trial attempts display + enforcement
apps/admin/src/components/reception/assign-dialog.tsx           — trial toggle removed
apps/admin/src/components/payments/payment-history.tsx          — "Prorated" label, transfer credit badge fix
apps/admin/src/components/teachers/trial-history.tsx            — NEW: teacher trial history component
apps/admin/src/app/(admin)/teachers/[id]/page.tsx               — trial history section
apps/admin/src/app/(admin)/students/[id]/page.tsx               — Group History with reasons, trial status, "Moved to" links
apps/admin/src/app/(admin)/groups/[id]/page.tsx                 — pass trial attempts + groupType to dialogs
```

---

## Phase 15: Reassignment & Orphan Detection

**Goal:** A dedicated holding area for students who were previously in a group and need re-placement — separate from Reception (which is for brand-new students from amoCRM). Handles exam failures, graduation non-continuation, returning inactive students, and orphaned students.

**Depends on:** Phase 11 (graduation is a key trigger), but the schema change (`AWAITING_REASSIGNMENT` status) and basic page can be implemented earlier.

### Key Decisions

- **Reception = new students only.** Students fresh from amoCRM who've never been in a group.
- **Reassignment = returning students only.** Students who were previously in a group and need a new one.
- **Two separate lists, same assign dialog.** Both pages reuse the same assign dialog. Trial status is auto-determined on the server for all assignment paths — if the student has remaining free trial attempts for the group type, it's a trial; otherwise they're billed immediately. No UI toggle anywhere. Edge cases handled via promotions.

### Schema Change

- [x] **Add `AWAITING_REASSIGNMENT` to `StudentStatus` enum**
  - New lifecycle: `ACTIVE` → `AWAITING_REASSIGNMENT` → `ACTIVE` (re-assigned to new group)
  - Also: `INACTIVE` → `AWAITING_REASSIGNMENT` (returning students)
  - Student's level+stage is preserved — admin knows exactly where to place them

### Triggers (how students enter reassignment)

- [x] **Exam failure** — student fails mid or final exam → removed from group → status set to `AWAITING_REASSIGNMENT`. Level+stage stays as-is (e.g. "Beginner Final" stays "Beginner Final" — student does NOT restart the level).
- [x] **Graduation without continuation** — during Phase 11 graduation workflow, admin picks "Send to reassignment" for non-continuing students → `AWAITING_REASSIGNMENT`.
- [x] **"Send to reassignment" action** — available on ACTIVE student detail page. Sets status to `AWAITING_REASSIGNMENT`. Covers:
  - Orphaned students (ACTIVE with no active membership → AWAITING_REASSIGNMENT)
  - Manual removals from groups
  - Note: INACTIVE → AWAITING_REASSIGNMENT deferred to Phase 16 (Lost List "Send to reassignment" action)

### Orphan Detection (safety net)

- [x] **Detect ACTIVE students with zero active memberships** (leaveDate IS NULL on all memberships, or no memberships at all). These are students who slipped through — removed manually, edge cases, etc.
  - Show as a warning section at the top of the Reassignment page (or as a sidebar badge)
  - Admin can review and either send to reassignment or deactivate

### Reassignment Page (`/reassignment`)

- [x] **Sidebar nav item** — between Reception and Uncertain, with count badge
- [x] **Table columns:** CRM, name, phone, level+stage, previous group (last active membership's group), reason (exam failure / graduation / returning / manual), date entered reassignment
- [x] **Assign action** — reuses the same assign dialog as Reception (trial auto-determined by server)
- [x] **Deactivate action** — if student is no longer interested, deactivate with lostReason → student moves to **Lost List** (Phase 16) for win-back follow-up

### Cross-references with Lost List (Phase 16)

- **Reassignment → Lost List:** "Deactivate" action on Reassignment page sets student to INACTIVE with lostReason → appears in Lost List for win-back scripts.
- **Lost List → Reassignment:** "Send to reassignment" action on Lost List (or student detail page) sets INACTIVE → AWAITING_REASSIGNMENT → appears on Reassignment page.
- **Graduation → Lost List:** "Deactivate" option during graduation (Phase 11) sends student directly to Lost List.
- Students can move between Lost List and Reassignment multiple times (e.g., won back from Lost List → reassigned → leaves again → Lost List).

### Implementation Notes

- **Query file:** `src/lib/queries/reassignment.ts` with three functions: `getReassignmentStudents` (AWAITING_REASSIGNMENT students with last group info), `getReassignmentCount` (for sidebar badge), `getOrphanedStudents` (ACTIVE students with zero active memberships).
- **Send to reassignment action:** `sendToReassignment` in `src/lib/actions/students.ts` redesigned as a **group-level action** accepting `(studentId, membershipId)`. Closes the specific membership with `performLeaveBilling`, creates pending refund if overpayment exists, and only sets status to `AWAITING_REASSIGNMENT` if no other active memberships remain. Also accepts INACTIVE students (clears inactivation fields). "Send to Reassignment" button removed from student-actions.tsx (student detail page) — now only available in group student list.
- **Send to lost list action:** New `sendToLostList(studentId, membershipId, { lostReasonId, otherLostReason })` in `src/lib/actions/students.ts`. Same membership-scoped logic as sendToReassignment. If no other active memberships, deactivates with lost reason. UI: inlined into `MemberActionsMenu` (student-list.tsx) and `TrialActionsMenu` (trial-resolution-dialog.tsx) dropdown menus.
- **Deactivate student redesigned:** `deactivateStudent` is now a "nuclear option" that auto-closes ALL active memberships via `performLeaveBilling(adjustmentType: "DROPOUT")`, creates pending refunds for overpayments, then sets INACTIVE. Button demoted to subtle muted link in student-actions.tsx.
- **Reassignment → ACTIVE flow:** Updated `addStudentsToGroup` and `resolveTrialMembership` in `src/lib/actions/group-memberships.ts` to handle AWAITING_REASSIGNMENT → ACTIVE transitions.
- **Auto-determined trial status:** Removed `isTrial` from schema, UI, and all assignment paths. `addStudentsToGroup` now auto-determines per student by checking `wasTrialOriginally` count against the limit (2 for GROUP, 1 for INDIVIDUAL). Also removed the trial toggle checkbox from the group detail "Add Student" dialog and the `trialAttempts` computation. Edge cases handled via promotions.
- **AssignDialog reuse:** Both Reception and Reassignment use the same dialog with no trial prop — server decides.
- **Reassignment page:** `src/app/(admin)/reassignment/page.tsx` server component. Table at `src/components/reassignment/reassignment-table.tsx` with assign and deactivate actions.
- **Orphan warning:** `src/components/reassignment/orphan-warning.tsx` always-visible collapsible section at top of Reassignment page. Auto-expanded when orphans exist (amber styling), collapsed when empty (muted styling with explanatory text). Displays ACTIVE students with no active group membership, with send-to-reassignment and deactivate actions.
- **Sidebar:** Added Reassignment nav item with `RefreshCw` icon between Reception and Uncertain, with badge count.
- **Layout:** Added `getReassignmentCount` to `Promise.all` in `src/app/(admin)/layout.tsx`.
- **Revalidation:** Added `/reassignment` path revalidation to graduation, `deactivateStudent`, `addStudentsToGroup`, and `resolveTrialMembership`.

### Files

```
packages/database/prisma/schema.prisma              — add AWAITING_REASSIGNMENT to StudentStatus (Phase 11)
apps/admin/src/lib/queries/reassignment.ts           — query AWAITING_REASSIGNMENT students + orphan detection
apps/admin/src/lib/actions/students.ts               — sendToReassignment action + deactivate revalidation
apps/admin/src/lib/actions/group-memberships.ts      — AWAITING_REASSIGNMENT → ACTIVE + auto-trial determination (removed isTrial from input)
apps/admin/src/lib/actions/group-graduation.ts       — revalidation for /reassignment
apps/admin/src/schemas/group-membership.ts           — removed isTrial from addStudentsSchema
apps/admin/src/app/(admin)/reassignment/page.tsx     — server component page
apps/admin/src/components/reassignment/reassignment-table.tsx — client component table with assign + deactivate
apps/admin/src/components/reassignment/orphan-warning.tsx    — orphan detection warning component (always-visible collapsible)
apps/admin/src/components/groups/send-to-lost-dialog.tsx    — DELETED (Phase B): inlined into dropdown menus
apps/admin/src/components/groups/student-list.tsx            — added Reassign + Lost buttons for non-trial active members
apps/admin/src/components/reception/assign-dialog.tsx — removed isTrial prop, language warning indicator (all levels)
apps/admin/src/components/groups/add-student-dialog.tsx — removed trial toggle UI + trialAttempts prop
apps/admin/src/app/(admin)/groups/[id]/page.tsx      — removed trialAttempts computation
apps/admin/src/components/students/student-actions.tsx — added "Send to Reassignment" for ACTIVE students
apps/admin/src/components/app-sidebar.tsx             — add Reassignment nav item with RefreshCw icon + badge
apps/admin/src/app/(admin)/layout.tsx                — fetch reassignment count in Promise.all
```

---

## Phase 16: Lost List & Win-Back

**Goal:** A dedicated page for INACTIVE students — students who left the school. Admins follow specific scripts to win these students back. Separate from Reassignment (which is for students who need re-placement but haven't left).

**Depends on:** Phase 2 (student deactivation already exists). Independent of most other phases — can be implemented early.

### Lost Page (`/lost`)

- [x] **Sidebar nav item** — with count badge showing total inactive students
- [x] **Table columns:** CRM, name, phone, level+stage, lost reason, deactivation date, deactivated by, last group (from most recent membership)
- [x] **Search/filter:** by name (DataTable search)
- [x] **"Assign to group" action** — opens the assign dialog directly from the Lost List. Student goes INACTIVE → ACTIVE (trial auto-determined server-side). For when admin knows which group to place the student in right away.
- [x] **"Send to reassignment" action** — INACTIVE → AWAITING_REASSIGNMENT → student appears on Reassignment page (Phase 15). For when the student wants to return but the group hasn't been decided yet.
- [x] **Contact info:** phone prominently displayed for admin to call/message as part of win-back scripts
- [x] **Notes/history:** admin can view student detail (existing page) for full history — groups attended, duration, comments

### Win-Back Flow

```
Student deactivated (lostReason set)
  → Appears in Lost List
  → Admin follows win-back script (call/message)
  → Student wants to return:
    Option A: Admin knows the group → "Assign to group" → INACTIVE → ACTIVE (direct)
    Option B: Group TBD → "Send to reassignment" → AWAITING_REASSIGNMENT → Reassignment page (Phase 15) → assign → ACTIVE
```

### Implementation Notes

- **Trial auto-determination:** Assigning from Lost List uses the same `addStudentsToGroup` action as Reception/Reassignment. Trial status is auto-determined server-side (Phase 14 logic) — returning students who haven't used their free trial still get one.
- **Inactivation field cleanup:** When transitioning INACTIVE → ACTIVE (direct assign) or INACTIVE → AWAITING_REASSIGNMENT (send to reassignment), the inactivation fields (inactivatedAt, inactivatedById, lostReasonId, otherLostReason) are cleared.
- **`sendToReassignment` extended:** Now accepts both ACTIVE and INACTIVE students. ACTIVE → AWAITING_REASSIGNMENT (existing). INACTIVE → AWAITING_REASSIGNMENT (new, clears inactivation fields).
- **`addStudentsToGroup` extended:** Activation check now handles INACTIVE status in addition to AWAITING_ASSIGNMENT and AWAITING_REASSIGNMENT.
- **Revalidation:** `/lost` added to deactivateStudent, reactivateStudent, sendToReassignment, addStudentsToGroup, resolveTrialMembership, graduateGroup.

### Files

```
NEW:
apps/admin/src/lib/queries/lost.ts                   — getLostStudents, getLostCount
apps/admin/src/app/(admin)/lost/page.tsx              — server component page
apps/admin/src/components/lost/lost-table.tsx          — client table with assign + send-to-reassignment

MODIFIED:
apps/admin/src/lib/actions/students.ts                — extend sendToReassignment for INACTIVE, add /lost revalidation
apps/admin/src/lib/actions/group-memberships.ts       — extend activation for INACTIVE, add /lost revalidation
apps/admin/src/lib/actions/group-graduation.ts        — add /lost revalidation
apps/admin/src/components/app-sidebar.tsx              — Lost nav item + lostCount badge
apps/admin/src/app/(admin)/layout.tsx                 — fetch + pass lostCount
```

---

## Phase 17: Promotion Auto-Detection & Application Rules

**Goal:** Implement auto-detection logic and finalize promotion types. Currently all promotions except TRIAL and REFERRAL are manually assigned.

**Depends on:** Phase 12 (promotion infrastructure).

### Key Decisions (confirmed with co-founder 2026-03-21)

**PromotionType enum — new:**
`SEASONAL, FAMILY, REFERRAL, WIN_BACK, TRIAL, PROMO_CODE, APOLOGY, REWARD`

**Removed:** LOYALTY (→ REFERRAL), EARLY_PAYMENT, PARTNER, OTHER

**Promotion types (finalized):**

| Type | Discount | Trigger | Duration | Auto/Manual |
|------|----------|---------|----------|-------------|
| FAMILY | 100,000 UZS | 2+ active family members | Recurring, indefinite (auto-removed when <2 active) | Auto |
| REFERRAL | 100,000 UZS | Referred: immediately on referral recording. Referrer: on referred student's first payment | One-time, first cycle (both referrer AND referred) | Auto (existing) |
| PROMO_CODE | Varies per campaign | Celebrity/campaign code at student creation | One-time, first cycle | Auto on creation |
| WIN_BACK | 100,000 UZS | Student assigned from Lost List | One-time, first cycle back | Auto |
| SEASONAL | Varies per campaign | Student created during campaign window OR assigned during window with 0 committed memberships | One-time, first committed cycle | Auto |
| APOLOGY | 100,000 UZS | Admin applies manually (service recovery) | One-time (can repeat) | Manual |
| REWARD | 100,000 UZS | Admin applies manually | One-time (can repeat) | Manual |
| TRIAL | Varies (100% group, 50% individual) | Auto on trial membership | One-time per trial | Auto (existing) |

**Rules:**
- All promotions stack additively, clamped to `amountDue` (constraint #36). Applied greedily per period (TRIAL first); non-recurring promos that find no room defer to the next period instead of being wasted
- REFERRAL and PROMO_CODE are mutually exclusive (one acquisition channel per student)
- Only FAMILY has auto-removal (stops applying from next billing cycle when <2 active family members; don't retroactively remove from current/past periods)
- Application timing: next billing cycle for existing students, first billing cycle for newly joining students

**WIN_BACK tracking fix:**
- `sendToReassignment()` must NOT clear inactivation fields (`lostReasonId`, `inactivatedAt`, etc.) when INACTIVE → AWAITING_REASSIGNMENT
- Fields cleared only at final activation in `addStudentsToGroup`
- `lostReasonId != null` at activation = definitively a win-back student (graduation/exam-failure students never have lostReasonId)

**SEASONAL eligibility:**
- "New student" = 0 non-trial committed memberships (`GroupMembership.count({ isTrial: false }) === 0`)
- Two trigger points: (a) at registration if campaign active, (b) at assignment/commit if campaign active and student doesn't already have it
- StudentPromotion persists even if assignment happens after campaign ends

**Seed data (8 promotions):**

| Name | Type | Discount | Notes |
|------|------|----------|-------|
| Trial Group Free Lesson | TRIAL | 100% | Existing, unchanged |
| Trial Individual 50% | TRIAL | 50% | Existing, unchanged |
| Referral Reward | REFERRAL | 100,000 UZS | Existing, type LOYALTY → REFERRAL |
| Referral Welcome | REFERRAL | 100,000 UZS | Existing, type LOYALTY → REFERRAL |
| Family Discount | FAMILY | 100,000 UZS | **New**, recurring indefinite |
| Win-Back Discount | WIN_BACK | 100,000 UZS | **New**, one-time |
| Apology Discount | APOLOGY | 100,000 UZS | **New**, one-time |
| Reward Discount | REWARD | 100,000 UZS | **New**, one-time |

### Scope

- [x] **Schema migration** — PromotionType enum change
- [x] **Zod + UI constant updates** — promotion type dropdowns/badges
- [x] **WIN_BACK tracking fix** — stop clearing inactivation fields in `sendToReassignment`
- [x] **Auto-detection in `addStudentsToGroup`** — WIN_BACK, SEASONAL, FAMILY (new helper `src/lib/helpers/promotion-auto-detect.ts`)
- [x] **SEASONAL at registration** — in `createStudent()`
- [x] **FAMILY auto-removal** — in `deactivateStudent()` + future period cleanup + `updateStudent()` on family change
- [x] **PROMO_CODE support** — student form field + `createStudent()` action + mutual exclusivity with REFERRAL
- [x] **Referral type migration** — LOYALTY → REFERRAL in `payments.ts` + seed
- [x] **Documentation** — update `implementation-plan.md` + `DATA_MODEL.md`

**Order of operations in `addStudentsToGroup`:**
```
1. Create membership + schedule slots + billing periods (existing)
2. Auto-detect WIN_BACK (lostReasonId != null)
3. Auto-detect SEASONAL (0 non-trial memberships + active campaign)
4. Auto-detect FAMILY (2+ active family members)
5. Activate student (set ACTIVE, clear inactivation fields)
6. applyPromotionsToPeriods() (existing — picks up auto-created StudentPromotions)
7. Apply FAMILY to existing family members' future periods (if newly eligible)
```

### Implementation Notes

**New file:**
- `src/lib/helpers/promotion-auto-detect.ts` — `detectWinBack()`, `detectSeasonal()`, `detectFamily()`, `applyFamilyToExistingMembers()`, `removeFamilyIfNeeded()`

**Modified files:**
- `schema.prisma` — PromotionType enum
- `schemas/promotion.ts`, `promotion-form.tsx`, `promotion-table.tsx` — enum/labels
- `schemas/student.ts` — added `promoCode` and `referredByCode` fields (both base + full schema), mutual exclusivity refine
- `student-form.tsx` — side-by-side promo code + referral code inputs (create mode only), mutually exclusive (entering one disables the other)
- `students/[id]/edit/page.tsx` — passes `promoCode: null, referredByCode: null` in defaultValues
- `students.ts` — `createStudent()`: transactional (student + PROMO_CODE + SEASONAL + REFERRAL via referredByCode). `updateStudent()`: FAMILY detect/remove on family change. `deactivateStudent()`: auto-closes all memberships with leave billing + FAMILY auto-removal. `sendToReassignment(studentId, membershipId)`: membership-scoped removal with leave billing. `sendToLostList(studentId, membershipId, data)`: new, membership-scoped deactivation with lost reason.
- `group-memberships.ts` — `addStudentsToGroup()`: auto-detection (WIN_BACK → SEASONAL → FAMILY → activate → apply → FAMILY for existing members)
- `payments.ts` — LOYALTY → REFERRAL lookup
- `referrals.ts` — mutual exclusivity check (REFERRAL vs PROMO_CODE)
- `seed.ts` — 8 promotions (TRIAL ×2, REFERRAL ×2, FAMILY, WIN_BACK, APOLOGY, REWARD). Referral Welcome changed from PERCENTAGE 10% to FIXED_AMOUNT 100k

---

## Phase 18: Scenario Testing

**Goal:** Validate the entire system end-to-end by walking through realistic operational scenarios in the live admin panel, catching edge cases that unit tests and per-phase development miss.

**Depends on:** All phases.

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
- [x] **Teacher file uploads** — Implemented in Phase F. `TeacherDocument` model, R2 storage via AWS SDK, `TeacherDocumentsSection` on teacher detail page.
- [ ] **Uncertain history UI** — Display `UncertainHistory` records on the student detail page (e.g., timeline/history section showing flag date, reason, resolution date). Data is stored from Phase G but has no display UI yet.


---

## Feedback Phases

Post-launch improvements from user feedback (`feedback.md`). These are separate from the core implementation phases above.

### Phase A: Bug Fixes & Broken Behavior ✅

Completed. See `feedback.md` for details.

### Phase B: Trial Resolution Overhaul ✅

Completed. See `feedback.md` for details.

### Phase C: Payment Controls & Visibility ✅

Completed. See `feedback.md` for details.

### Phase D: Small UI Polish ✅

Completed. Changes:

- [x] **#4 — Phone search on reception + students tables** — Custom multi-field search (name, phone, parent phone) replacing DataTable's single-column `searchKey`. Reception query (`getReceptionStudents`) updated to include `dateOfBirth` and `family.parentPhone`.
- [x] **#5 — Comment column visibility** — Reception table comment column: `text-muted-foreground` → `text-foreground`.
- [x] **#9 — Age column** — Added to reception table, students table, and group detail student list. Shared `getAge()` helper extracted to `src/lib/helpers/date.ts`.
- [x] **#11 — Schedule → teacher navigation** — Teacher names in schedule grid wrapped in `<Link>` to `/teachers/[id]`.
- [x] **#23 — Teacher active/deactivated filter** — Filter pills on teachers page. Wired up existing `getAllTeachers(includeInactive)` query. Deactivated teachers show muted styling + badge.
- [x] **#30 — Lessons by month** — Group detail page shows monthly breakdown instead of single total.
- [x] **MONTH_NAMES consolidation** — `MONTH_NAMES` (short) and `MONTH_NAMES_FULL` (long) extracted to `src/lib/constants.ts`, replacing 8 inline definitions.

**Files changed:** `reception-table.tsx`, `student-table.tsx`, `student-list.tsx`, `schedule-grid.tsx`, `teacher-table.tsx`, `groups/[id]/page.tsx`, `teachers/page.tsx`, `constants.ts`, `helpers/date.ts` (new), `queries/reception.ts`, `queries/groups.ts`, plus 7 files updated for MONTH_NAMES imports.

### Phase E: Reception Workflow ✅

Completed. Reception page now has pill-tabbed views:

- [x] **#1 — Add Student button** — Links to `/students/new?returnTo=/reception`. `createStudent` accepts optional `redirectTo` (whitelisted to `/reception`). Breadcrumb adapts based on origin.
- [x] **#2 — First Lessons tab** — New `getFirstLessonsData()` query fetches active trial memberships, batch-finds first lesson per student, checks attendance via `getTrialMembershipAttendance`. `FirstLessons` component displays attendance badges + reuses `TrialActionsMenu` for actions.
- [x] **#3 — Second Lessons tab** — New `getSecondLessonsData()` query fetches committed-from-trial students with unpaid current-month billing + attended lesson counts. `SecondLessons` component shows red highlight for 2+ lessons attended.
- [x] **Pill tab wrapper** — `ReceptionView` component with Reception/First Lessons/Second Lessons toggle (counts in pills).

**Code review fixes:** `getTrialMembershipAttendance` parallelized (sequential → `Promise.all`). Attendance query always includes `lessonId` to prevent cross-matching. `getGroupsForTransfer` param made optional.

**Files changed:** `reception/page.tsx`, `students/new/page.tsx`, `student-form.tsx`, `actions/students.ts`, `queries/reception.ts`, `queries/students.ts`, `queries/transfers.ts`. New: `reception-view.tsx`, `first-lessons.tsx`, `second-lessons.tsx`.

### Phase F: Teacher Management ✅

Completed. Three items: availability redesign, rate history editing, teacher file uploads.

- [x] **#10 — Availability redesign** — Full rewrite of `availability-editor.tsx`. Per-day checkboxes (Mon–Sun) replaced with "Mon, Wed, Fri" / "Tue, Thu, Sat" pattern toggles. Free-form `<Input type="time">` replaced with `TIME_SLOTS` `<Select>` dropdowns. Both patterns can be active simultaneously, each with multiple time ranges. Display mode shows pattern label + time badges. Hydration merges legacy per-day data into patterns. Unavailability form (`unavailability-form.tsx`) time inputs also swapped to TIME_SLOTS selects. No schema or action changes — purely UI.
- [x] **#12 — Rate history editing** — Inline edit per rate row (pencil icon → editable inputs → save/cancel). Min(1) validation added to `rateChangeSchema`. New `updateRateChangeSchema`. Server-side `validateRateLimits()` queries `getCurrentPriceLimits()` (max PriceSetting price across GENERAL/IELTS per group type) to cap rates. Price limits shown as helper text ("Max: X UZS") + `max` attribute on inputs. New `updateRateChange()` action in `actions/teachers.ts`. Existing `addRateChange` also now validates against PriceSetting caps.
- [x] **#12 — Delete UNPAID payment records** — New `deleteTeacherPaymentPeriod()` action in `actions/teacher-payments.ts` (guards PAID records). Payment history table extracted from inline server component to `PaymentHistoryTable` client component with trash icon + `ConfirmationDialog` on UNPAID rows. PAID rows have no action. Correction flow: edit rate → delete UNPAID record → "Generate Pay" recreates with corrected rate via `skipDuplicates`.
- [x] **#18 — Teacher file uploads** — `TeacherDocument` model added to Prisma schema. AWS SDK deps added. `TeacherDocumentsSection` component on teacher detail page.

**Files changed:** `availability-editor.tsx` (rewrite), `unavailability-form.tsx`, `rate-history.tsx`, `teachers/[id]/page.tsx`, `actions/teachers.ts`, `actions/teacher-payments.ts`, `queries/teachers.ts`, `schemas/teacher.ts`, `schemas/teacher-payment.ts`, `schema.prisma`. New: `payment-history-table.tsx`.

### Phase G: Uncertain Students ✅

Completed. Structured uncertain reasons + history tracking + actions on the uncertain page.

- [x] **#24 — Uncertain reason dialog** — New `UncertainReason` reference table (14 reasons + Other) and `UncertainHistory` model for audit trail. `markUncertain` action replaces the old `toggleUncertain` — opens a dialog with reason dropdown + optional "Other" textarea. `resolveUncertain` action clears the flag and closes the history record. `UncertainToggle` in group student list now opens the dialog when flagging, and directly calls `resolveUncertain` when clearing.
- [x] **#25 — Uncertain page actions** — `UncertainTable` rewritten with dropdown action menu per row: Remove uncertain mark, Transfer, Send to Reassignment, Send to Lost list. Multi-membership students get a group selector step inside action dialogs. `sendToReassignment` and `sendToLostList` now auto-clear the uncertain flag + resolve history when the student was uncertain. Uncertain page fetches transfer reasons, lost reasons, and available groups for the action dialogs.

**Schema changes:** New `UncertainReason` model, new `UncertainHistory` model, `uncertainReasonId` field added to `Student`. Migration: `20260325120000_add_uncertain_reason_and_history`.

**Files changed:** `schema.prisma`, `seed.ts`, `actions/students.ts`, `queries/students.ts`, `schemas/uncertain.ts` (new), `uncertain-reason-dialog.tsx` (new), `uncertain-table.tsx` (rewrite), `uncertain/page.tsx`, `groups/student-list.tsx`, `groups/[id]/page.tsx`, `__tests__/helpers/db.ts`.

### Phase H: Promotions, Comments & Constraints ✅

Completed. See commit history.

### Phase I: Exams & Scheduling ✅

Completed. See commit history.

### Phase J: Scheduled Actions — Seat Reservation, ASSIGN & CHANGE_TEACHER ✅

Completed. Extends the base scheduled actions system (Phase J original) with seat reservation, two new action types, and removes scheduled DEACTIVATE.

- [x] **Seat reservation (date-aware capacity)** — New `capacity.ts` module with `getScheduledCapacity(groupId, asOfDate)` and `getGroupScheduledCounts()`. All 4 server-side capacity checks (addStudentsToGroup, transferTrialStudent, executeTransfer, executeMerge) now use date-aware capacity. Schedule page, group detail, and all group picker dialogs (transfer, merge, assign) show `↓N ↑N` departure/arrival indicators.
- [x] **ASSIGN as scheduled action** — Future-dated assignments create a `ScheduledAction` instead of immediate membership. Core logic extracted to `execute-assign.ts`. Conflict detection: blocks duplicate assigns to same group, same-type group limit violations, and pending deactivations.
- [x] **CHANGE_TEACHER as scheduled action** — Future-dated teacher changes create a `ScheduledAction`; only lessons from effective date onward get reassigned. Core logic extracted to `execute-change-teacher.ts` with shared `checkTeacherScheduleConflicts` helper (validates at both scheduling and execution time).
- [x] **Remove scheduled DEACTIVATE** — Deactivation is now immediate-only. Send to Lost per-membership covers the same ground with per-group granularity, eliminating the capacity tracking gap.
- [x] **Scheduled actions table improvements** — Collapsed Source/Destination into Details column with action-type-aware rendering and navigation links. Default filter changed to Pending. Tab styling aligned with Payment History.
- [x] **Group detail scheduled actions** — Table showing pending actions for the group with cancel button, displayed between students and past members.

**Schema changes:** Added `ASSIGN` and `CHANGE_TEACHER` to `ScheduledActionType` enum. Migrations: `20260329102713_add_assign_scheduled_action_type`, `20260329105439_add_change_teacher_action_type`. Split `deactivateStudentSchema` from `sendToLostSchema`.

**New files:** `capacity.ts`, `execute-assign.ts`, `execute-change-teacher.ts`, `group-scheduled-actions.tsx`.

**Key modified files:** `actions/group-memberships.ts` (thin wrapper), `actions/lessons.ts` (thin wrapper), `actions/students.ts` (remove scheduled deactivate), `execute-scheduled-action.ts` (ASSIGN + CHANGE_TEACHER cases), `scheduled-action-conflicts.ts` (ASSIGN + CHANGE_TEACHER conflict checks), `scheduled-actions-table.tsx` (Details column), all group picker queries (scheduled counts).

### Phase K: Holidays Management ✅

Completed. Admins can view and add holidays via `/holidays`. Adding a holiday cancels all SCHEDULED lessons on that date (without replacement), adjusts billing downward, and handles overpayment via credit-forward or PENDING refund. No delete from UI — record removal is too risky (doesn't undo cancellations/billing).

- [x] **Schema** — Added `HOLIDAY` to `AdjustmentType` enum. Added "Holiday" `CancellationReason` (seeded with `isActive: false` so it doesn't appear in manual cancellation dropdown).
- [x] **Holiday billing helper** (`holiday-billing.ts`) — Transactional: cancels lessons, deletes TeacherScheduleSlots, adjusts each affected StudentPaymentPeriod (reduce totalLessons by 1, recalculate amountDue/discount/status), creates PaymentPeriodAdjustment with type HOLIDAY. Overpayment → credit to next month's period or PENDING refund. Moves exams on the holiday to the next scheduled lesson.
- [x] **Create holiday action** — Future dates only (Tashkent timezone). All-or-nothing transaction: creates Holiday record + runs billing helper. Handles P2002 (duplicate date). Sets `cancellationReasonId` to the "Holiday" reason on cancelled lessons.
- [x] **Holidays page** — Year filter pills (current + 2 next years), grouped table (consecutive dates merged into ranges with "X days" badge), search by name. Read-only — no delete action exposed.
- [x] **Sidebar** — "Holidays" entry under Reference section with CalendarOff icon.
- [x] **Exported `recalculateDiscount`** from `leave-billing.ts` for reuse.

**Schema changes:** `HOLIDAY` added to `AdjustmentType` enum. Migration: `20260329124838_add_holiday_adjustment_type`.

**New files:** `schemas/holiday.ts`, `queries/holidays.ts`, `helpers/holiday-billing.ts`, `actions/holidays.ts`, `app/(admin)/holidays/page.tsx`, `components/holidays/holidays-table.tsx`, `components/holidays/add-holiday-dialog.tsx`.

**Key modified files:** `schema.prisma` (enum), `leave-billing.ts` (export), `app-sidebar.tsx` (nav entry), `seed.ts` (Holiday cancellation reason).

### Phase L: Excused Absences ✅

Retroactive recording of valid absences with automatic billing and teacher pay adjustments. Required by law for cases like illness, power outage, force majeure.

- [x] **Schema** — Added `ExcusedAbsenceReason` reference table (seeded: Illness, Power outage, Internet outage, Family emergency, Force majeure, Other). Added `ExcusedAbsence` model with embedded document fields (fileName/fileKey/fileSize on R2). Added `EXCUSED_ABSENCE` to `AdjustmentType` enum. Unique constraint: `(lessonId, studentId)`.
- [x] **Billing helper** (`excused-absence-billing.ts`) — Mirrors `holiday-billing.ts`: reduces totalLessons by 1, recalculates amountDue/discount/status via `recalculateDiscount()` and `calculatePaymentStatus()`, creates `PaymentPeriodAdjustment` with type `EXCUSED_ABSENCE`. Overpayment → credit to next month or PENDING refund. Reversal function for deletion (increases totalLessons by 1, own audit record).
- [x] **Server actions** (`excused-absences.ts`) — Create (with optional R2 document upload), delete (with billing reversal + R2 cleanup). Validates: lesson is COMPLETED, membership matches, no duplicates, reason.isOther requires otherReason text.
- [x] **Teacher pay modification** — `generateTeacherPay()` now fetches excused absences for the period, builds count-per-lesson map, subtracts from `activeStudentCount` per lesson.
- [x] **Queries** — `getStudentExcusedAbsences()`, `getExcusedAbsenceReasons()`, `getEligibleLessonsForExcuse()` (COMPLETED lessons from active memberships, excludes already-excused and replacement lessons).
- [x] **UI** — `ExcusedAbsencesSection` client component on student detail page (after Payments, before Promotions). Table of existing records + "Add" dialog with lesson selector, reason dropdown, optional note, optional file upload. Delete with confirmation showing billing reversal impact.

**Infrastructure fix:** Resolved persistent Prisma migration drift by folding `data_integrity_constraints.sql` into a tracked migration (`20260410134129_data_integrity_constraints`) and marking it as applied. Configured shadow database (Neon `neondb_shadow`) for `migrate dev`. Future migrations work cleanly.

**Schema changes:** `EXCUSED_ABSENCE` added to `AdjustmentType` enum. New models: `ExcusedAbsenceReason`, `ExcusedAbsence`. Migration: `20260411124414_add_excused_absence`.

**New files:** `schemas/excused-absence.ts`, `queries/excused-absences.ts`, `actions/excused-absences.ts`, `helpers/excused-absence-billing.ts`, `components/students/excused-absences-section.tsx`.

**Key modified files:** `schema.prisma` (enum + 2 models + back-relations), `seed.ts` (6 reasons), `actions/teacher-payments.ts` (excused count subtraction), `students/[id]/page.tsx` (section + queries), `prisma.config.ts` (shadowDatabaseUrl).

### Phase M: Lead Conversion & Lesson Type Preference ✅

Two intertwined features. Adds `Student.preferredLessonType` (GROUP / INDIVIDUAL / EITHER) — required at creation, drives a hard filter in the assign dialog and a daily filter on /reception. Adds a "Convert" action on every `/leads` row that opens `/students/new?leadId=X&returnTo=/reception` with the form prefilled from lead data; submitting flips the lead to `CONVERTED` and links `Student.leadId` in a single transaction.

- [x] **Schema** — Extended `LessonPreference` enum with `EITHER` (rename-and-recreate pattern, mirrors `simplify_lead_enums`). Added required `Student.preferredLessonType` (backfilled to `EITHER` for existing rows via temporary DEFAULT, then dropped). Added unique nullable `Student.leadId` FK to `Lead` with `ON DELETE SET NULL`. Migration: `20260429120000_add_lesson_type_and_lead_link`.
- [x] **Validation** — `studentSchema` requires `preferredLessonType`. New `lib/helpers/lead-to-student.ts` maps lead → student form defaults: name/phone/DOB 1:1; `language` (uz/ru) → `preferredLanguage` (UZBEK/RUSSIAN/ANY); `lessonPreference` → `preferredLessonType` (EITHER fallback when null); `selfAssessedLevel COMPLETE_BEGINNER` → `level BEGINNER` (CONTINUING leaves blank); `note` → `comment`.
- [x] **Server actions** — `createStudent` accepts optional `leadId`; in-txn pre-check rejects already-CONVERTED leads, sets `leadId` on student, flips lead to `CONVERTED`. P2002 on `leadId` unique index maps to "lead already converted" (handles concurrent double-submit).
- [x] **Queries** — `getLeadForPrefill(id)` (returns `student` link so the page can show "already converted to #X"). `getReceptionStudents`, `getReassignmentStudents`, `getLostStudents` select the new field.
- [x] **UI: form** — `StudentForm` has a required radio (Group / Individual / Either) and new `cancelTo` prop (Cancel goes to `/leads` from the conversion flow instead of `window.history.back()`). Edit page passes the field.
- [x] **UI: convert action** — `LeadsTable` has a "Convert" column linking to `/students/new?leadId=X&returnTo=/reception`. Disabled when lead is `CONVERTED`. Stale `PAIR` label dropped.
- [x] **UI: assign dialog** — Hard filter via `lib/helpers/group-eligibility.ts:isEligibleByLessonType`. Type-mismatched groups disappear entirely. Empty-state copy reflects the filter. Type chip in student-info header.
- [x] **UI: reception filter** — Segmented buttons (All / Group / Individual / Either) above the table. Type column added. New field shown on `/students/[id]` detail and `reassignment-table`.
- [x] **Tests** — Factory updates: `createTestStudent` defaults `preferredLessonType: "EITHER"`; new `createTestLead` factory. Test `db.ts` table lists include `Lead`. Integration: `lead-conversion.test.ts` (happy path, already-converted guard, duplicate-phone rollback, concurrent P2002 race, LOST → conversion allowed). Unit: `group-eligibility.test.ts`, `lead-to-student.test.ts`.

**New files:** `lib/helpers/lead-to-student.ts`, `lib/helpers/group-eligibility.ts`, `__tests__/scenarios/lead-conversion.test.ts`, `__tests__/group-eligibility.test.ts`, `__tests__/lead-to-student.test.ts`.

**Key modified files:** `schema.prisma`, `schemas/student.ts`, `lib/queries/leads.ts`, `lib/queries/reception.ts`, `lib/queries/reassignment.ts`, `lib/queries/lost.ts`, `lib/actions/students.ts`, `app/(admin)/students/new/page.tsx`, `app/(admin)/students/[id]/page.tsx`, `app/(admin)/students/[id]/edit/page.tsx`, `components/students/student-form.tsx`, `components/leads/leads-table.tsx`, `components/reception/assign-dialog.tsx`, `components/reception/reception-table.tsx`, `components/reassignment/reassignment-table.tsx`, `components/lost/lost-table.tsx`.

### Phase N: Leads Worklist Overhaul ✅

Reshapes `/leads` from a flat status-tab table with inline edit affordances into a workflow-driven worklist. The page now sorts leads by urgency tier, opens a controlled drawer for each lead, and treats every per-lead action (set callback, mark test sent, edit preferences, etc.) as a structured mutation with a transactional activity-log entry. Born from reading 122 production admin notes and watching admins drown in free-text shorthand (`НЕДОЗВОН`, `Не оставлял`, test scores, callback times all hand-typed into one field).

Built across the conversation in five logical phases — schema/foundation, drawer + Mark-as-Lost dialog, callback/test/preferences sections + soft conversion gate, urgency cues + sort + tabs, and a final perf pass (client-side drawer + tab-scoped fetching).

- [x] **Schema** — Two migrations.
  - `leads_worklist`: new Lead fields (`preferredDays`, `preferredTimeSlots`, `testSentAt`, `testLevelSent`, `testScore`, `testScoredAt`, `nextCallbackAt`, `lostReason`, `lostReasonOther`), new `LeadActivity` append-only model with FK cascade to Lead and SetNull to AdminUser, new enums (`LeadLostReason` — named to avoid collision with the existing `LostReason` student-lifecycle reference table; `LeadActivityType`), new indexes `nextCallbackAt` and `(status, nextCallbackAt)`.
  - `lead_preferences_any`: `preferredDaysAny` and `preferredTimeSlotsAny` Boolean flags so "admin explicitly marked flexible" is distinguishable from "not yet captured" (both store empty arrays).
- [x] **Activity log** — `recordLeadActivity()` chokepoint helper writes inside the caller's transaction. Discriminated `LeadActivityMetadata` TS union mirrors the JSON column shape. `autoTransitionToContacted()` flips NEW → CONTACTED + emits `STATUS_CHANGE` whenever admin touches a NEW lead (note save, schedule set, callback set, test marked sent, score recorded). Telegram link click does **not** auto-transition (deliberate — link-only).
- [x] **Soft conversion gate** — `evaluateConversionGate(lead) → { ready, missing[] }` is a single pure helper used by the drawer hint and the row urgency chip. Beginner gate: days + time captured. Continuing gate: above + test score. **Not enforced** in `createStudent` — admin can convert anytime; the gate just informs.
- [x] **Server actions** — `actions/lead-fields.ts` (new): `setPreferredSchedule`, `setNextCallback`, `markCallbackDone`, `markTestSent`, `recordTestScore`. `actions/leads.ts`: `markLeadLost` added with required reason enum (rejects CONVERTED leads). `actions/lead-fetch.ts` (new): `fetchLeadDetailAction`, `fetchLeadsByTabAction` for client-driven reads (bends the no-reads-via-actions rule for one-off on-demand calls). `actions/students.ts → createStudent` emits `STATUS_CHANGE` + `CONVERTED` activities when flipping the lead.
- [x] **Drawer (controlled, client-state)** — Right-side Sheet with bordered card sections: Header (status/urgency pill, name, meta caption, Telegram link, Mark as Lost / Restore as red link), Preferences (single Change button → dialog with MWF/TTS/Any + time-slot chips + Any), Callback (Schedule button → dialog with tonight quick-sets / +Xh offsets / native date+time inputs / pending selection + Save), Placement test (Mark sent / Change score dialogs, always rendered even for beginners in case of miscategorization), Note (Change button → dialog with 12-row Textarea, multi-line preserved), Activity feed (read-only, Tashkent time), sticky-bottom Convert button (always enabled, amber missing-details hint when gate unmet). Each mutation calls an `onChange` callback that refetches drawer detail + reloads current tab.
- [x] **Mark-as-Lost dialog** — 7 enum reasons + OTHER free text. Required.
- [x] **Urgency tier system** — `getUrgencyInfo(lead)` derives tier (red/green/blue/amber/idle) + chip from lead fields. Priority red ▸ green ▸ blue ▸ amber ▸ idle. 8 chips documented in `apps/admin/src/components/leads/CHIPS.md`. Header pill mirrors row chip colors; status pill is fallback for idle leads. Stale thresholds: NEW > 24h = red, CONTACTED > 3d = amber.
- [x] **Table simplification** — 4 columns: urgency chip, Name (with relative time stacked below), Lang · Level (plain muted text), Note (growing, multi-line via `whitespace-pre-wrap line-clamp-3`). Removed: status badge column, phone column, lesson-type column, dedicated created column, inline status dropdown, inline note editor, inline Convert column. Sort: NEW > CONTACTED > CONVERTED > LOST (status primary), then urgency tier desc within status.
- [x] **Tabs simplified** — Active (NEW + CONTACTED) / Lost / Converted / All. Default tab is Active. Per-tab stale-counter removed (urgency cues live on rows now).
- [x] **DataTable shared component** — Added opt-in `meta.cellClassName` / `meta.headerClassName` pass-through and `onRowClick` prop. Default behavior unchanged for other callers per CLAUDE.md shared-component rule.
- [x] **Performance pass** —
  - Tab-scoped fetching: `getLeads({ statuses? })` — page loads only Active leads initially. Other tabs lazy-load via `fetchLeadsByTabAction`. After mutations, the visible non-Active tab refetches explicitly (Active is auto-refreshed via `revalidatePath`).
  - Client-side drawer state: dropped `?lead=` URL param. Drawer state lives in `LeadsTabs`. Lost URL shareability and browser-back-closes-drawer in exchange for instant drawer toggle (no full page refetch).
- [x] **Telegram contact link** — Pure `t.me/+phone` link. Removed earlier Call/WhatsApp buttons and per-channel activity emission (too noisy).
- [x] **Schemas / validation** — `schemas/lead.ts` validators for all new mutations. Day pattern enforces MWF or TTS or empty. Mark-as-Lost refines `otherText` required when reason is OTHER.
- [x] **Updated `lead-to-student` prefill** — Days/time/level/score now prefill the student form on convert. Test score and admin note prepend into `Student.comment` so the qualifying-call context survives conversion. Unit test fixture extended to cover new fields.

**Documentation:** `apps/admin/src/components/leads/CHIPS.md` (chip catalogue + criteria), `DATA_MODEL.md` (new Leads Worklist section), this entry.

**Not in scope (deferred for follow-up):**
- Phone deduplication at intake (resubmissions create duplicate Lead rows today).
- Snooze / defer-until ("call back in autumn" cases).
- Quick-copy outbound message templates for Telegram.
- Landing form additions: age field (filter out kids at intake), Telegram username (more reliable fallback).
- Integration tests for the new mutation actions — only the existing `lead-to-student` unit tests cover Phase N today.
- Cross-tab search (search is scoped to the currently loaded tab).
- URL-driven drawer deep-links (removed for perf; could be re-added behind a feature flag if shareability becomes important).

**New files:** `lib/helpers/lead-activity.ts`, `lib/helpers/lead-conversion-gate.ts`, `lib/actions/lead-fields.ts`, `lib/actions/lead-fetch.ts`, `components/leads/lead-drawer.tsx`, `components/leads/lead-drawer-header.tsx`, `components/leads/lead-drawer-note.tsx`, `components/leads/lead-activity-feed.tsx`, `components/leads/lead-callback-section.tsx`, `components/leads/lead-test-section.tsx`, `components/leads/lead-convert-button.tsx`, `components/leads/lead-urgency-chip.tsx`, `components/leads/mark-as-lost-dialog.tsx`, `components/leads/CHIPS.md`.

**Renamed in place:** `components/leads/lead-conversion-checklist.tsx` (now exports `LeadPreferences`).

**Deleted:** `components/leads/lead-status-select.tsx`, `components/leads/lead-note-editor.tsx` (inline editors superseded by drawer).

**Key modified files:** `packages/database/prisma/schema.prisma`, `lib/helpers/lead-staleness.ts` (added urgency tier + chip), `lib/helpers/lead-to-student.ts` (extended prefill), `lib/queries/leads.ts` (statuses filter + activity feed), `lib/actions/leads.ts` (markLeadLost + transactional activity emission), `lib/actions/students.ts` (CONVERTED activity), `schemas/lead.ts`, `components/leads/leads-table.tsx`, `components/leads/leads-tabs.tsx`, `components/ui/data-table.tsx` (opt-in meta className + onRowClick), `app/(admin)/leads/page.tsx`.

### Phase O: Reception Worklist Redesign ✅

Same pattern as Phase N applied to `/reception` — turns the awaiting-assignment table into a worklist driven by an urgency chip and curriculum-ordered sort, with page-level search and Reception-scoped Type/Lang filters lifted out of the table.

- [x] **Urgency chip column** — new helper `lib/helpers/reception-staleness.ts` with `getReceptionUrgency(createdAt) → { tier, label }`. Tiers: blue (< 3d), amber (≥ 3d), red (≥ 7d). Label shape: `Just arrived` / `Waiting Xh` / `Waiting Xd`. Always rendered (no null tier); thresholds exported as `RECEPTION_AMBER_DAYS = 3`, `RECEPTION_RED_DAYS = 7`.
- [x] **Default sort by curriculum level** — custom `sortingFn` uses `LEVEL_STAGE_ORDER` (BEGINNER:BEGINNING → IELTS:FINAL); tie-break by `createdAt asc` (longest-waiting in each level cluster first); unknown level+stage combos fall to the bottom via `Number.MAX_SAFE_INTEGER` rather than mysteriously floating to the top via `indexOf` returning −1.
- [x] **Column trim** — dropped CRM, Phone (now subtitle of Name), Created (info carried by chip), separate Days/Time (merged into `Schedule`), separate Type (merged into `Type · Lang`).
- [x] **Multi-line `Comment`** — shared `EditCommentDialog` gained an opt-in `displayMode: "truncate" | "multiline"` prop with `truncate` default. Reception passes `multiline`; the other 3 callsites (reassignment-table, groups/student-list, students/student-comment-edit) keep existing single-line behavior.
- [x] **Search lifted to page level** — visible on every tab (`Reception` / `Scheduled` / `First Lessons` / `Second Lessons`). Substring match across name, CRM code, and phone (digit-normalized); Reception also includes parent phone. Shadcn `<Input>` for theming consistency with `/leads`.
- [x] **Type / Lang filters scoped to Reception** — `ToggleGroup`s in the `/schedule` UZ/RU style. Selected state high-contrast (`data-[state=on]:bg-primary`). Vertical dividers between search ↔ Type ↔ Lang. Filter semantics intentionally loose: `Type: Group` matches `GROUP` OR `EITHER`; `Lang: UZ` matches `UZBEK` OR `ANY`. No "All" / "Either" / "Any" filter values — they'd be redundant.
- [x] **Tabs converted to `/leads`-style underline** — `flex border-b` + `border-b-2 -mb-px` per item; muted count next to each label.
- [x] **State lifted to `ReceptionView`** — search, type filter, lang filter, and the four filtered arrays all derived in the view and passed down. `ReceptionTable` is now a pure presentation component.
- [x] **Hygiene** — new `ReceptionStudentRow` export from `queries/reception.ts` (cleaner than the previous `Parameters<typeof ReceptionTable>[0]["data"][number]` indirection). `matchesSearch` extracted to a top-level helper accepting variadic phones, killing four `eslint-disable react-hooks/exhaustive-deps` comments. Kebab trigger got `aria-label="Actions"`. `Type · Lang` cell normalized to `text-sm` matching `Schedule`.

**Not in scope (deferred):**
- Group-suggestion column (one-row recommendation per student).
- Drawer-based assign flow (currently a centered modal; could match the /leads drawer convention).
- Tabs / kebab accessibility — raw `<button>` tabs lose ARIA tablist semantics; codebase-wide migration (also affects `/leads`).
- Hydration warning from `Date.now()` in the chip cell — known noise, accept until a proper "no chip until mounted" gating is justified.

**New files:** `lib/helpers/reception-staleness.ts`.

**Key modified files:** `components/reception/reception-view.tsx`, `components/reception/reception-table.tsx`, `components/shared/edit-comment-dialog.tsx` (opt-in `displayMode` prop), `lib/queries/reception.ts` (`ReceptionStudentRow` export).

**Documentation:** `admin-panel-plan.md` Reception section rewritten to describe the post-UX-pass shape (layout, columns, filter semantics, sort).

---

## Revisit

Decisions to revisit with co-founder before finalizing.

- **Offline reschedule (C#27)** — Currently implemented: when student and teacher privately agree to move an individual lesson to a different time, admin records the change in the system (updates date/time, swaps teacher schedule slot). **Question: is this needed?** If admin doesn't record it, the schedule view shows the lesson at the original time and conflict detection doesn't know about the real time — could allow double-booking the teacher. For individual lessons this is low-risk since teachers manage their own schedule. If we decide it's not needed, hide the "Offline Reschedule" button (code stays, just not exposed).
- **Offline reschedule scope** — C#27 says "Not applicable to group lessons", but in practice offline reschedules happen for both group and individual lessons. Currently the button only shows for individual groups. Revisit whether to allow for both group types.
- ~~**FAMILY promotion on family change**~~ — Handled in Phase 17. `updateStudent` now runs `removeFamilyIfNeeded` on old family + `detectFamily` on new family when `familyId` changes for active students.

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
| 30 | Absence policy (regular: no billing impact; excused: billing + pay adjusted) | 8, L | [x] |
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

These are tracked in migration `20260410134129_data_integrity_constraints` (and the standalone `data_integrity_constraints.sql` kept for reference). Not app-level, but verify they exist:

| Constraint | What |
|-----------|------|
| `active_membership_unique` | Partial unique index: one active membership (leaveDate IS NULL) per student per group |
| `student_crm_code_trigger` | BEFORE INSERT: computes crmCode from sequenceNumber |
| `group_public_id_trigger` | BEFORE INSERT: computes publicId (GR-N / IND-N) from type + sequenceNumber |
| `current_group_teacher_unique` | Partial unique index: one current teacher (endDate IS NULL) per group in GroupTeacherHistory |
