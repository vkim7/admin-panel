# Data Model Reference

Human-readable guide to the database schema. Use this to understand how entities relate, what constraints exist, and where to watch for edge cases.

---

## Entity Relationship Overview

```
Family (parent info)
  └── Student* (one family has many students; adults typically have no family but can optionally be linked to one)

Student
  ├── GroupMembership* ──→ Group (many-to-many through membership history)
  ├── Attendance* (per-lesson attendance records)
  ├── StudentPaymentPeriod* (monthly billing per group)
  │     ├── Payment* (actual payments received, including transfer credits)
  │     ├── Refund* (refunds for unused lessons on dropout)
  │     ├── PaymentPeriodAdjustment* (audit trail for manual edits)
  │     └── AppliedPromotion* (which promotions discounted this period)
  ├── StudentPromotion* (active promotions for this student)
  ├── Referral* (as referrer or as referred)
  ├── CallHistory* (reception follow-up calls)
  └── SmsHistory* (payment reminder texts)

Teacher
  ├── TeacherAvailability* (which days/times they can work — recurring weekly pattern)
  ├── TeacherUnavailability* (specific dates they can't work — sick days, appointments)
  ├── TeacherScheduleSlot* (which dates they're actually booked)
  ├── TeacherRateChange* (pay rate history with effectiveFrom dates)
  ├── Lesson* (lessons they teach, including substitutions)
  ├── Group* (groups they teach — both GROUP and INDIVIDUAL types)
  ├── TeacherPaymentPeriod* (monthly pay records per group)
  └── GroupTeacherHistory* (assignment history per group)

Holiday (standalone — dates when no lessons are scheduled)

Group (unified: both group lessons and individual lessons)
  ├── GroupMembership* (students in this group, past and present)
  ├── TeacherScheduleSlot* (one slot per lesson date — for conflict detection)
  ├── (price determined by global PriceSetting, not per-group)
  ├── Lesson* (pre-created lesson sessions with lifecycle tracking)
  ├── Attendance* (denormalized for query performance)
  ├── Exam* (mid/final exams)
  ├── StudentPaymentPeriod* (billing records)
  ├── GroupTeacherHistory* (which teachers have taught this group, past and present)
  ├── Group* (merge chain — mergedFromGroups / mergedIntoGroup)
  └── Group* (graduation chain — graduatedFromGroups / graduatedIntoGroup)

Promotion
  └── StudentPromotion* (which students have this promotion)
        └── AppliedPromotion* (which billing periods it actually discounted)
```

---

## Core Entities

### AdminUser
Platform administrators. Authenticated via Telegram Login Widget.

| Field | Purpose |
|-------|---------|
| telegramId | Unique Telegram ID, used for auth |
| role | SUPER_ADMIN or ADMIN |
| isActive | Soft-delete flag |

**Links to:** Payment (who recorded it), CallHistory (who called), SmsHistory (who sent)

---

### Teacher
Teachers who conduct lessons via Zoom.

| Field | Purpose |
|-------|---------|
| phone | Teacher's phone number |
| telegramId | Optional — for future teacher app auth |
| levels[] | Which levels they can teach (Postgres array) |
| teachingLanguage | Teaching language capability: UZBEK, RUSSIAN, or ANY (both). Reuses the PreferredLanguage enum. Used for hard enforcement at BEGINNER/ELEMENTARY — student can't be assigned to a group whose teacher doesn't speak their preferred language. |
| isActive | Soft-delete flag |
| deactivatedAt | When isActive was set to false (audit trail) |
| deactivatedById | Which admin deactivated this teacher |

**Pay rates** are tracked in `TeacherRateChange` (history table with `effectiveFrom` dates) — not on the Teacher entity. See [TeacherRateChange](#teacherratechange) for details.

**Pay calculation:** `lessons delivered × active students in group × rate` for both group and individual types. The rate used depends on `Group.type`: GROUP → `groupLessonRate`, INDIVIDUAL → `individualLessonRate`. Rates are negotiated as percentages of the student-facing price, then calculated, rounded, and stored as fixed amounts to avoid rounding errors in billing.

**Deactivation workflow:** Before setting `isActive = false`, each of the teacher's active groups must be individually reassigned to a different teacher (based on availability and level fit — each group may go to a different teacher). All future SCHEDULED lessons and their TeacherScheduleSlots for each reassigned group are updated. Do not deactivate a teacher with unresolved active groups. Set `deactivatedAt` and `deactivatedById` when deactivating (audit trail — mirrors Student's `inactivatedAt`/`inactivatedById` pattern).

**Links to:** TeacherAvailability (when they can work), TeacherUnavailability (specific dates they can't work), TeacherScheduleSlot (when they're booked), Lesson (lessons they teach, including substitutions), Group (groups and individual arrangements they teach), GroupTeacherHistory (assignment history per group), TeacherRateChange (pay rate history)

---

### Family
Groups students who share a parent/guardian. Created when enrolling a minor.

| Field | Purpose |
|-------|---------|
| name | Optional label, e.g., "Lee family" |
| parentFirstName/lastName | Parent or guardian name |
| parentPhone | Primary contact for billing/reminders for all children in this family |

**When to create:** On enrollment of any minor. Second sibling links to the existing family (searchable by parent phone, parent name, sibling phone, or sibling name). **Dedup warning:** When creating a new family, search by `parentPhone` first — if a match exists, warn the admin to link to the existing family instead of creating a duplicate (constraint #35).

**Adults:** Typically have no family record (`familyId = null`), but can optionally be linked to one if needed.

---

### Student
Central entity. One record per student, surfaced in multiple views (Reception, Group Details, No Payment List, Student Management) via status filters.

| Field | Purpose |
|-------|---------|
| crmCode | Unique business identifier — plain sequence number as string (e.g., "1", "42"). Used across all surfaces. NOT the primary key. Computed by a DB trigger from `sequenceNumber` (see `data_integrity_constraints.sql`). Provide explicitly to override. |
| sequenceNumber | Auto-incrementing integer for race-condition-free ID generation. crmCode is computed from this by a DB trigger. |
| phone | Student's own Telegram-linked phone. Required for Mini App invite. DB-unique (may relax later for siblings). |
| telegramId | Optional Telegram ID for future student Mini App auth via Telegram initData. DB-unique. |
| dateOfBirth | Date only (no time). Used to determine minor status at enrollment — minors must have a Family link (application constraint). |
| level | Current English level (BEGINNER through IELTS) |
| progressStage | Where the student is within their level: BEGINNING, MID, or FINAL. Set during placement and used for group matching (groups within 3 stages on the linear scale are shown as suggestions). Defaults to BEGINNING. |
| status | Lifecycle: AWAITING_ASSIGNMENT → ACTIVE → INACTIVE (also AWAITING_REASSIGNMENT for returning/failed students) |
| familyId | Links to Family for minors (under 18 at enrollment). Null for adults. |
| preferredDays[] | Scheduling preference, e.g., [1, 3, 5] for Mon/Wed/Fri |
| preferredTimeSlots[] | Time slot preferences, e.g., ["14:30", "16:00"] — subset of fixed TIME_SLOTS |
| preferredLanguage | UZBEK, RUSSIAN, or ANY. Defaults to ANY for new students. **Hard enforcement** at BEGINNER and ELEMENTARY: student cannot be assigned to a group whose teacher can't teach in the selected language (blocked at server action level and excluded from assign dialog suggestions). **Soft preference** at PRE_INTERMEDIATE+: used for sorting/boosting in suggestions but doesn't block assignment. |
| referralCode | Unique code for referral tracking |
| isUncertain | Manual flag — teacher/admin gut feeling that student may leave |
| uncertainFlaggedBy | Who flagged: TEACHER or ADMIN |
| uncertainComment | Optional note explaining why flagged |
| comment | General admin notes on the student |
| amoCrmLeadId | Dedup key for amoCRM polling integration |
| activatedAt | When status changed to ACTIVE (assigned to first group) |
| activatedById | Which admin activated (audit trail) |
| inactivatedAt | When status changed to INACTIVE |
| inactivatedById | Which admin deactivated (audit trail) |
| lostReasonId | Why the student left the school (links to LostReason reference table) |
| otherLostReason | Free text when the lost reason is "other" |

**Lifecycle:**
```
amoCRM placement test passed
  → Student created (status: AWAITING_ASSIGNMENT)
  → Visible in Reception
  → Admin assigns to group (always a trial for new students)
  → status: ACTIVE
  → Visible in Group Details, Student Management, No Payment List

Path A — Student leaves school:
  → status: INACTIVE, lostReasonId set
  → Visible in Lost List (dedicated win-back page), Student Management
  → Admin follows win-back script (call/message)
  → If student wants to return → Path C

Path B — Student needs reassignment (exam failure, graduation without continuation):
  → status: AWAITING_REASSIGNMENT
  → Visible in Reassignment page
  → Admin assigns to new group (no trial — already had one)
  → status: ACTIVE

Path C — Inactive student returns (won back from Lost List):
  → Option A: "Assign to group" directly from Lost List → INACTIVE → ACTIVE (no trial)
  → Option B: "Send to reassignment" → INACTIVE → AWAITING_REASSIGNMENT → Path B

Students can cycle between Lost List and Reassignment multiple times.
```

**Multiple simultaneous groups:** A student can be in both a GROUP and INDIVIDUAL lesson at the same time (or multiple groups). Each is a separate GroupMembership with independent billing. The `active_membership_unique` constraint only prevents duplicate active memberships for the same student+group pair, not across different groups. Admin adds the student to additional groups via Group Details "Add student" — no status change needed since the student is already ACTIVE. **Schedule conflict detection (C#40):** when adding a student to a group, check if the student has any other active membership in a group with overlapping schedule (same days AND overlapping time based on duration). Block with error: "Student is already in group {publicId} at this time."

**Uncertain List (auto-criteria):** Computed at query time — students with 3+ absences or 3+ incomplete homework. The `isUncertain` flag is for manual gut-feel flagging, separate from auto-criteria. Thresholds are hardcoded in application logic.

---

## Holidays

### Holiday
Official public holidays when no lessons are held. Used during lesson pre-creation to skip non-working dates.

| Field | Purpose |
|-------|---------|
| date | The holiday date (unique, date-only) |
| name | Human-readable name, e.g., "Navruz" |

**Used at group creation time:** When pre-generating all Lesson records from startDate to endDate, dates that fall on holidays are skipped. This means the total lesson count (and therefore billing) is based on actual teaching days.

**Seeded with:** Uzbekistan 2026 public holidays (New Year, Women's Day, Navruz, Eid al-Fitr, Day of Remembrance, Eid al-Adha, Independence Day, Constitution Day).

---

## Scheduling

### TeacherAvailability
When a teacher is available to work. One row per day+time block.

| Field | Purpose |
|-------|---------|
| dayOfWeek | 1=Monday, 7=Sunday (ISO 8601) |
| startTime | e.g., "14:00" |
| endTime | e.g., "22:00" |

**Example:** Teacher A works Mon/Wed/Fri 14:00–22:00 → 3 rows.

**Unique constraint:** One entry per teacher per day per start time. A teacher can have multiple blocks per day (e.g., morning 07:00–12:00 and evening 18:00–22:00).

---

### TeacherScheduleSlot
**DB-enforced no-double-booking.** One row per **specific date** a lesson occurs (not recurring day-of-week). Slots are pre-created alongside Lesson records when a group is set up.

| Field | Purpose |
|-------|---------|
| teacherId | Which teacher |
| date | Specific lesson date (e.g., 2026-03-09) — not a recurring day-of-week |
| startTime | Which time ("14:00") |
| groupId | Which group (includes both GROUP and INDIVIDUAL types) |
| lessonId | Direct link to the Lesson this slot belongs to (unique — one slot per lesson) |

**Unique constraint:** `(teacherId, date, startTime)` — a teacher cannot be in two places at once on any given date.

**Slots are only for conflict detection.** The Lesson record preserves history (cancelled, rescheduled, etc.). When a lesson is cancelled, its slot is **deleted** (freeing the teacher's time). When a substitute teaches, the old slot is deleted and a new slot is created for the substitute teacher. The `lessonId` FK provides a direct link for easier cleanup during cancellation/substitution (no need to query by teacher+date).

**Created alongside Lessons:** When a group is created, slots are generated for every lesson date from startDate through endDate, skipping holidays.

---

### Group
**Unified model for both group lessons (up to 6 students) and individual lessons (typically 1 student).** The `type` field determines which.

| Field | Purpose |
|-------|---------|
| publicId | Human-readable ID shown in UI (e.g., "GR-1" for groups, "IND-1" for individual). Computed by a DB trigger from `sequenceNumber` (see `data_integrity_constraints.sql`). Provide explicitly to override. |
| sequenceNumber | Auto-incrementing integer for race-condition-free ID generation. publicId is computed from this by a DB trigger. |
| type | GROUP or INDIVIDUAL |
| days[] | Which days the group meets, e.g., [1, 3, 5] for Mon/Wed/Fri. **Immutable after creation** — all lessons and schedule slots are pre-created based on this pattern. To change days, create a new group and transfer students. |
| startTime | Lesson start time, e.g., "14:00" |
| durationMinutes | Lesson length, default 80. Can be 60. |
| level | English level |
| progressStage | BEGINNING, MID, or FINAL — which third of the program |
| maxStudents | Default 6 for GROUP. For INDIVIDUAL: currently 1, but may be 2 (not yet decided). Enforced at application level. |
| isActive | Soft-delete flag |
| startDate | When the group starts |
| endDate | **Required, auto-calculated.** Before 15th → end of startMonth+2, after 15th → end of startMonth+3. Updated when lessons are rescheduled past the original end. |
| mergedIntoGroupId | Self-reference — set if this group was merged into another (GROUP or INDIVIDUAL type) |
| zoomLink | Group's Zoom meeting link |

**endDate calculation:**
- Start date day < 15 → endDate = last day of (startMonth + 2). Example: Feb 1 → Apr 30
- Start date day >= 15 → endDate = last day of (startMonth + 3). Example: Jan 15 → Apr 30
- If a lesson is cancelled and rescheduled past endDate, endDate is bumped to the new last lesson date.

**Main Schedule display:** Each cell shows group ID, level, progress stage, and paid count vs total (e.g., "GR-1 Beginner beg 4+1T/6"). Individual lessons show as "IND-1 Intermediate".

**Group merge:** When two groups at the same level merge, the absorbed group's `mergedIntoGroupId` points to the surviving group, `isActive` is set to false. All active memberships in the old group get `leaveDate` set, and new memberships in the surviving group are created with `previousMembershipId` linking to the old membership (for traceability). Works for both GROUP type (two small groups combine) and INDIVIDUAL type (two 1-student arrangements combine into one 2-student individual group).

**Group graduation (level progression):** When a group's program ends, the admin triggers graduation to create a next-level group and move continuing students.

| Field | Purpose |
|-------|---------|
| skipAutoGraduation | If true, skip the auto-graduation prompt when the program ends |
| graduatedIntoGroupId | Self-reference — the next-level group created for continuing students |

**Level progression order:** BEGINNER → ELEMENTARY → PRE_INTERMEDIATE → INTERMEDIATE → UPPER_INTERMEDIATE → IELTS. IELTS has no next level (graduation is not applicable).

**Graduation workflow:**
1. Admin triggers graduation for a group whose program is ending (no SCHEDULED or PENDING_RESOLUTION lessons remain — all are COMPLETED or CANCELLED, including any replacement lessons from rescheduling)
2. If `skipAutoGraduation = true` or `level = IELTS`, skip — no next-level group is created
3. Create a new group at the next level with the same teacher, days, startTime, durationMinutes, and maxStudents. `startDate` = next valid lesson date after the old group's last lesson (matching the day pattern, skipping holidays). `endDate` auto-calculated from `startDate`. `progressStage = BEGINNING`.
4. Price for the new group is determined by `PriceSetting` (derive `levelCategory` from the new group's level, then look up the most recent entry where `effectiveFrom <= today`)
5. Create initial `GroupTeacherHistory` for the new group
6. Pre-create lessons and `TeacherScheduleSlot`s for the new group (constraint #8)
7. Admin selects which students continue to the new group
8. Create new memberships in the new group with `previousMembershipId` linking to the old membership (triggers billing period pre-creation per constraint #32)
9. Auto-update `Student.level` to the new group's level for continuing students
10. Close old group: `isActive = false`, `graduatedIntoGroupId` set to the new group, `leaveDate` set on ALL active memberships (including students not continuing — for record-keeping only, since all lessons are already COMPLETED/CANCELLED and billing periods are finalized; this does NOT trigger per-membership leave billing #31)

**Edge cases:**
- Students who don't continue get `leaveDate` set but no new membership. Their lifecycle status stays ACTIVE unless separately deactivated.
- A group can have `mergedIntoGroupId` OR `graduatedIntoGroupId`, but not both — merge and graduation are mutually exclusive end-of-life events (enforced by Zod at the app level).
- Merge is allowed for both GROUP and INDIVIDUAL types. Individual merge example: two 1-student individual arrangements combine into one 2-student individual group.
- The new group starts fresh with its own lessons, schedule slots, and billing periods.

**Lesson price** is determined by `PriceSetting` — a global table with 4 price points: (GENERAL|IELTS) × (GROUP|INDIVIDUAL). Derive `levelCategory` from the group's `level` (IELTS → IELTS, everything else → GENERAL). See [PriceSetting](#pricesetting) for details.

**Teacher pay rate:** Determined by `type`. GROUP → `groupLessonRate`, INDIVIDUAL → `individualLessonRate` (both from `TeacherRateChange`).

---

## Group Teacher History

### GroupTeacherHistory
Tracks teacher assignments at the group level over time. One record per teacher assignment. NOT used for one-off substitutions (those are tracked at the Lesson level via `teacherId != originalTeacherId`).

| Field | Purpose |
|-------|---------|
| groupId | Which group |
| teacherId | Which teacher was assigned |
| startDate | When this teacher started teaching this group |
| endDate | When they stopped (null = current teacher) |
| changedById | Which admin made the change (null for initial assignment at group creation) |

**Created at group creation:** When a group is created, a GroupTeacherHistory record is created with `startDate = Group.startDate` and `endDate = null`.

**Permanent teacher change flow:**
1. Update `Group.teacherId` → new teacher
2. Set `endDate` on current GroupTeacherHistory record (the one with `endDate IS NULL`)
3. Create new GroupTeacherHistory (new teacher, startDate = today, endDate = null)
4. Update all future SCHEDULED lessons: set both `teacherId` AND `originalTeacherId` → new teacher
5. Swap TeacherScheduleSlots for those future lessons (delete old teacher's slots, create new teacher's slots)

**Why both `teacherId` and `originalTeacherId` are updated on future lessons:** This ensures that `teacherId != originalTeacherId` on a Lesson always means a one-off substitution, never a permanent reassignment. The distinction matters for teacher pay and substitution reporting.

---

## Group Membership

### GroupMembership
Tracks which students are in which groups (both GROUP and INDIVIDUAL types), including full history.

| Field | Purpose |
|-------|---------|
| joinDate | When the student joined this group |
| leaveDate | When they left (null = currently active) |
| isTrial | Trial student — occupies a seat but may not commit after first lesson |
| wasTrialOriginally | Snapshot: was this membership created as a trial? Set once at creation, never changes. Enables querying committed trials. |
| trialTeacherId | Snapshot: who was the group's teacher at trial time? FK → Teacher. Preserved even if group teacher changes later. |
| transferReasonId | Why they transferred (links to TransferReason table) |
| otherTransferReason | Free text for "other" transfer reason |
| comment | Per-group notes (e.g., "struggling with grammar", "catching up from lesson 5") |
| lessonsStart | Which lesson number the student joined at (for prorated billing) |
| lessonsCompleted | How many lessons taken before leaving |
| assignedById | Which admin created this membership (audit trail) |
| previousMembershipId | Links to the membership this continues from (group merge or transfer). Null for initial group assignments. |

**A student can rejoin a group** — no unique constraint on `[studentId, groupId]`. But a partial unique index prevents two SIMULTANEOUS active memberships for the same student+group (see `data_integrity_constraints.sql`).

**A student can be in multiple groups at once** — e.g., a GROUP lesson and an INDIVIDUAL lesson simultaneously. Each is a separate membership with independent billing periods. The unique constraint is scoped to `(studentId, groupId)` not `(studentId)` globally. Schedule conflict detection prevents overlapping time slots (see C#40).

**`leaveDate` is set for ALL membership endings** — transfers, dropouts, merges, graduations, and program completion. It always means "student is no longer active in this group." The reason for leaving is inferred from context:
- `transferReasonId` set → **Transfer** (student moved to another group)
- `student.status = INACTIVE` → **Dropped out** (reason on `Student.lostReasonId`)
- `group.mergedIntoGroupId` set → **Group merged**
- `group.graduatedIntoGroupId` set → **Group graduated** (program ended, next-level group created; null for IELTS — no next level)
- `leaveDate` set, none of the above → **Program completed** (or other reason)

**Trial students:**
- `isTrial = true` → student is taking a trial lesson, occupies a seat
- Counted toward `maxStudents` (a group with 5 + 1T is full)
- Displayed separately on Main Schedule: "4+1T/6"
- **Trial attempt limits:** GROUP = 2 free trials, INDIVIDUAL = 1 free trial per student. Enforced in `addStudentsToGroup` by counting `wasTrialOriginally=true` memberships per group type.
- **Differentiated billing:** GROUP trials are 100% free, INDIVIDUAL trials are 50% off. Two separate TRIAL promotions with `groupTypes` filter.
- **Resolution paths:**
  - **Commit**: set `isTrial = false`, create billing with appropriate TRIAL promotion discount
  - **Didn't continue**: set `leaveDate`, GROUP = no billing (free), INDIVIDUAL = bill attended lessons at 50% discount, deactivate student
- **Auto no-show detection:** On lesson completion, trial students marked absent are auto-removed (leaveDate set) and deactivated with appropriate lost reason
- **Trial status derivation** (from `wasTrialOriginally` + `isTrial` + `leaveDate` + attendance):
  - Pending: `isTrial=true AND leaveDate IS NULL`
  - Committed: `wasTrialOriginally=true AND isTrial=false`
  - Didn't continue: `wasTrialOriginally=true AND isTrial=true AND leaveDate IS NOT NULL AND has attendance`
  - No-show: `wasTrialOriginally=true AND leaveDate IS NOT NULL AND no attendance`
- **Stale trial alert:** Persistent visual alert for any unresolved trials. Query: `isTrial = true AND joinDate < today`.

---

### TransferReason (Reference Table)
Admin-manageable list of reasons a student transfers between groups.

Seeded with: Teacher dissatisfaction, Classmates dissatisfaction, Level too low, Level too advanced, Failed mid exam, Other.

`isOther = true` on the "Other" entry means the UI must show a free-text input.

### LostReason (Reference Table)
Admin-manageable list of reasons a student leaves the school.

Seeded with: Taking a break, Too expensive, Didn't like online format, Other, Trial no-show (Group), Trial no-show — final attempt (Group), Trial no-show (Individual), Trial — didn't continue (Group), Trial — didn't continue (Individual).

### CancellationReason (Reference Table)
Admin-manageable list of reasons a lesson is cancelled.

Seeded with: Teacher absence, Low attendance, Student request, Scheduling conflict, Administrative, Other.

`isOther = true` on the "Other" entry means the UI must show a free-text input (stored in `Lesson.otherCancellationReason`).

---

## Lessons & Attendance

### Lesson
A single lesson session (one date, one occurrence). **Pre-created** for the entire program when a group is set up — not created ad-hoc after lessons happen.

| Field | Purpose |
|-------|---------|
| groupId | Which group this lesson belongs to (required) |
| teacherId | **Who actually teaches this lesson.** Defaults to the group's teacher at creation. Updated to substitute teacher when needed. |
| originalTeacherId | **Who was originally scheduled (non-nullable).** Always set at creation time (= group's teacher). Stays unchanged when a substitute is assigned — only `teacherId` changes. Compare `teacherId != originalTeacherId` to detect substitutions. |
| lessonNumber | Sequential within the group |
| lessonDate | When the lesson happens |
| startTime | Denormalized from Group for direct queries (e.g., "what is this teacher doing today?") |
| status | **SCHEDULED** → **PENDING_RESOLUTION** → **COMPLETED** or **CANCELLED**. See lifecycle below. |
| originalDate | Original date before an offline reschedule (individual lessons only). Null = never moved. |
| originalStartTime | Original start time before an offline reschedule. Null = never moved. |
| pendingAt | When the lesson entered PENDING_RESOLUTION (set automatically when TeacherUnavailability is recorded). Null otherwise. |
| rescheduledFromId | Self-reference: if this lesson is a replacement, points to the cancelled original (one hop back). One-to-one (unique). |
| originalLessonId | Always points to the FIRST lesson in the reschedule chain (the one that was billed). Copied forward when a replacement is itself rescheduled. Null for original lessons. |
| cancelledAt | When the lesson was cancelled |
| cancelledById | Which admin cancelled this lesson (nullable — null if not cancelled) |
| cancellationReasonId | Links to CancellationReason (nullable — required if cancelledAt is set, enforced by Zod) |
| otherCancellationReason | Free text when the cancellation reason is "Other" (nullable) |
| completedAt | When the lesson was marked completed (nullable — no hard constraint, teacher may update later) |
| activeStudentCount | Snapshotted when lesson is marked COMPLETED. Count of active members **as of `lessonDate`** (not as of the moment completion is recorded — if there's a delay, use membership state at lesson date). Null while SCHEDULED. Used for teacher pay calculation. |
| notes | Teacher's notes on what was covered |
| recordingUrl | Zoom recording link |
| scheduleSlot | Relation to TeacherScheduleSlot (one-to-one via lessonId on the slot) |

**Unique constraint:** `(groupId, lessonNumber)` — no duplicate lesson numbers within a group.

**Lesson lifecycle:**
```
Pre-created at group setup
  → status: SCHEDULED
  → Lesson date arrives, teacher conducts class
  → status: COMPLETED

OR (teacher unavailable):
  → TeacherUnavailability recorded
  → status: PENDING_RESOLUTION, pendingAt set
  → Schedule slot KEPT (prevents double-booking while unresolved)
  → Admin resolves:
    → Substitute assigned: swap schedule slot, status back to SCHEDULED
    → Cancel + append: status → CANCELLED, slot deleted, replacement at end

OR (student cancels — individual lessons only):
  → Admin cancels with reason "Student request"
  → status: CANCELLED, cancelledAt set
  → TeacherScheduleSlot deleted (teacher IS free — student cancelled)
  → Replacement lesson created at next valid date after endDate
  → Replacement has rescheduledFromId → cancelled lesson
  → Group endDate bumped to new last date
  → Counts toward cancellation limit (max 2/month, 24h advance notice)

OR (admin cancels — any lesson type):
  → status: CANCELLED, cancelledAt set
  → TeacherScheduleSlot deleted
  → Replacement lesson created at next valid date after endDate
  → Replacement has rescheduledFromId → cancelled lesson
  → Group endDate bumped to new last date
```

**Offline reschedule (individual lessons only):**
When student and teacher agree to move a lesson to a different time (lesson still happens, no cancellation):
1. Set `originalDate` and `originalStartTime` to preserve the old values
2. Update `lessonDate` and `startTime` to the new values
3. Delete old TeacherScheduleSlot, create new one at the new date/time
4. Does NOT count toward cancellation limit. No billing impact.

**Substitute flow:**
1. `originalTeacherId` was already set at creation (= group teacher) — no change needed
2. Update the Lesson's `teacherId` to the substitute teacher
3. Delete the old TeacherScheduleSlot (original teacher + date)
4. Create a new TeacherScheduleSlot (substitute teacher + same date)
5. The Group `teacherId` stays unchanged — only this one lesson has a different teacher

To detect substitutions, query `WHERE teacherId != originalTeacherId`.

**Cancellation + reschedule flow:**
1. Mark lesson `status = CANCELLED`, set `cancelledAt`
2. Delete its TeacherScheduleSlot (frees the time for conflict detection)
3. Find the next valid date after current endDate (matching the group's day pattern, skipping holidays)
4. Create replacement Lesson with `rescheduledFromId` pointing to the cancelled one, and `originalLessonId` pointing to the first lesson in the chain (if the cancelled lesson has `originalLessonId`, copy it; otherwise use the cancelled lesson's own ID)
5. Create TeacherScheduleSlot for replacement
6. Update Group `endDate` to the new last lesson date

**Rescheduled lesson billing:** Replacement lessons have `originalLessonId` set, pointing to the first lesson in the reschedule chain (the one whose billing period already counted it). When calculating billable lessons for a month, **exclude lessons where `originalLessonId IS NOT NULL`** — they are "free" replacements already billed in the original period. Note: `totalLessons` on StudentPaymentPeriod counts all pre-created lessons for that month **including cancelled ones**, since replacements are excluded from future months' billing.

**Reschedule chains:** If a replacement is itself cancelled and rescheduled again, the new replacement copies `originalLessonId` from the previous replacement (always the first lesson in the chain). `rescheduledFromId` tracks the immediate predecessor (one hop back); `originalLessonId` tracks the billing origin (always the first).

### Attendance
Per-student, per-lesson attendance tracking.

| Field | Purpose |
|-------|---------|
| isAbsent | Default false. Teachers mark absences, not presences. |
| groupId | Denormalized from Lesson.groupId for query performance |

**Unique constraint:** `(lessonId, studentId)` — one record per student per lesson.

**Used for:** Teacher app group details view (attendance grid) and uncertain auto-criteria (3+ absences).

**Attendance records are pre-created** for all active group members (`leaveDate IS NULL`) with `isAbsent = false` when attendance is initialized for a lesson. Teacher updates `isAbsent` during or after the lesson. `isAbsent` is for tracking only — it does NOT affect student active/inactive status or billing.

**NOT used for billing or teacher pay.** Students are charged for all lessons in the period regardless of absences. Teacher pay is based on `activeStudentCount` (group membership size snapshotted at lesson completion), not who actually attended — a student who is absent is still counted for the teacher's pay because they're an active member.

---

## Payments

### StudentPaymentPeriod
Monthly billing record. One per student per group membership per month.

| Field | Purpose |
|-------|---------|
| groupId | Which group (required) |
| groupMembershipId | Links to the specific enrollment (required — allows correct billing when a student leaves and rejoins the same group) |
| periodYear / periodMonth | Which billing month |
| totalLessons | Actual count of pre-created lessons in that month (not a fixed 12). Varies by month based on how many lesson-days fall in it, minus holidays. |
| pricePerLesson | Snapshot of per-lesson price from `PriceSetting` at period creation (for audit trail) |
| amountDue | Full amount before discounts (totalLessons × pricePerLesson) |
| discountAmount | Total discount from all applied promotions |
| amountPaid | How much has been paid so far |
| paymentStatus | UNPAID → PARTIALLY_PAID → PAID |
| isPartialPeriod | True for first-month proration AND mid-month transfers (student leaves/joins a group mid-month, resulting in a partial billing period in both the old and new group) |

**Unique constraint:** `(groupMembershipId, periodYear, periodMonth)` — one billing period per enrollment per month (enforced natively by Prisma @@unique). `studentId` was removed from the constraint since `groupMembershipId` already implies the student.

**Price snapshot:** `pricePerLesson` is looked up from `PriceSetting` (derive `levelCategory` from group level, then most recent where `effectiveFrom <= period start`) at billing period creation time. If the price changes, only future periods are affected — past periods retain their original snapshot.

**Period pre-creation:** Billing periods are pre-created when a GroupMembership is created (and `isTrial = false`). The system counts pre-created Lessons per calendar month from `joinDate` through group `endDate`, and creates a `StudentPaymentPeriod` for each month with `pricePerLesson` snapshotted from `PriceSetting` (derive `levelCategory` from group level) and `amountDue = totalLessons × pricePerLesson`. Active promotions are applied at creation time: the student's active `StudentPromotion`s are queried, `discountAmount` is calculated per period, `AppliedPromotion` records are created, and `discountAmount` is set on each period. First month is `isPartialPeriod = true` if joining after the 1st. Trial students (`isTrial = true`) do NOT get billing periods — periods are created when the student commits (`isTrial` → `false`), using the original `joinDate`.

**No Payment List:** Purely query-based — all periods already exist from membership creation. Query: `WHERE paymentStatus != PAID AND periodYear = X AND periodMonth = Y`. All active students appear on the 1st of each month; the list shrinks as payments come in. Search should match by both `Student.phone` and `Family.parentPhone` to quickly find records when a parent sends a payment receipt via Telegram.

### Payment
Individual payment transaction. A StudentPaymentPeriod can have multiple payments (partial payments).

| Field | Purpose |
|-------|---------|
| studentId | Which student this payment is for (direct link) |
| studentPaymentPeriodId | Which billing period (optional — payment can exist without a period) |
| amount | How much was paid |
| isTransferCredit | Default false. True when this payment represents a credit from unused lessons after a mid-month transfer (see Transfer Billing Flow below). Queryable and filterable — displayed visually distinct from real payments. |
| paymentMethod | "click", "payme", "cash", etc. |
| note | Admin note, e.g., "paid by uncle", receipt reference |
| recordedById | Which admin recorded this payment |
| paidAt | When the payment was made |

### PaymentPeriodAdjustment
Audit trail for billing period modifications. One record per adjustment. Snapshots before/after values so changes are fully traceable.

| Field | Purpose |
|-------|---------|
| studentPaymentPeriodId | Which billing period was modified |
| type | What triggered this: `MANUAL`, `TRANSFER`, `DROPOUT`, or `MERGE` |
| previousTotalLessons | totalLessons before the change |
| previousAmountDue | amountDue before the change |
| previousDiscountAmount | discountAmount before the change |
| newTotalLessons | totalLessons after the change |
| newAmountDue | amountDue after the change |
| newDiscountAmount | discountAmount after the change |
| reason | Additional context — always useful for MANUAL, optional for system-triggered |
| adjustedById | Which admin triggered the change (required) |

**Created when:**
- `MANUAL` — admin manually edits billing period fields (error correction, dispute resolution)
- `TRANSFER` — student transfers mid-month, source group's period is adjusted (unused lessons removed)
- `DROPOUT` — student goes INACTIVE, period adjusted to lessons up to leave date
- `MERGE` — group merge, same mechanics as transfer

Every modification creates a new adjustment record — they are append-only and immutable.

**Used for:** Audit trail, dispute resolution, detecting billing errors. The adjustment history is viewable alongside the billing period details.

### Transfer Billing Flow
When a student transfers mid-month with unused paid lessons:

1. **Group A (source):** Adjust the StudentPaymentPeriod — reduce `totalLessons` and `amountDue` to reflect only lessons before transfer. A `PaymentPeriodAdjustment` record captures the before/after snapshot.
2. **Group B (destination):** Apply the transfer credit across destination billing periods using **spill-over**: fill the first period (up to its `amountDue - discountAmount`), carry any remainder to the next period, and so on. Each application creates a `Payment` with `isTransferCredit = true`.
3. **Residual credit:** If the transfer credit exceeds the total of all destination periods combined (e.g., destination group is near end-of-program), auto-create a `Refund` with `status = PENDING` for the remainder. This uses the same refund infrastructure as dropout overpayments.
4. **Recalculate `paymentStatus`** on all affected periods using the standard helper (constraint #16).

This ensures:
- The student isn't double-charged for lessons they already paid for
- Credit is distributed accurately — no single period is overpaid while others remain unpaid
- Excess credit that can't be absorbed is tracked as a pending refund (not silently lost)
- The credit is visible and queryable (filter by `isTransferCredit`)
- Full audit trail exists on both sides (adjustment on A, transfer credit payments on B)

### Per-Membership Leave Billing
Triggered when `leaveDate` is set on a GroupMembership mid-program (dropout, transfer, or merge). **NOT triggered for graduation** — at graduation all lessons are already COMPLETED/CANCELLED and billing periods are finalized (see Graduation workflow).

1. **Current month's period:** Reduce `totalLessons` to lessons between `joinDate` and `leaveDate` (inclusive), recalculate `amountDue`. This mirrors how `buildPaymentPeriods` creates periods (filtering lessons `>= joinDate`), ensuring a mid-month joiner isn't charged for lessons before they joined. Create `PaymentPeriodAdjustment` for audit trail.
2. **Future months' periods:** Hard-delete — they are untouched (UNPAID, no payments, no adjustments, no applied promotions).
3. **Recalculate `paymentStatus`** on current period.
4. **Handle overpayment** based on leave type:
   - **Transfer** (`transferReasonId` set) or **Merge** (`group.mergedIntoGroupId` set): do NOT create a Refund. Instead, create a `Payment` with `isTransferCredit = true` on the new group's billing period (see Transfer Billing Flow above).
   - **Dropout / other**: if `amountPaid > (amountDue - discountAmount)`, auto-create a `Refund` with `status = PENDING` and `amount` = overpayment.

This is triggered per-membership, not per-student. A student can leave one group while staying ACTIVE in others. The student only goes INACTIVE (with `lostReasonId`) when they leave ALL groups.

### Refund
Refund for unused lessons when a student leaves a group mid-billing-period. Auto-created in PENDING state when the per-membership leave billing detects an overpayment.

| Field | Purpose |
|-------|---------|
| studentId | Which student |
| studentPaymentPeriodId | Which billing period (required) |
| amount | Calculated refund amount (overpayment = amountPaid - (amountDue - discountAmount)) |
| amountRefunded | Actual amount returned — recorded on completion. Null while pending. |
| status | PENDING → COMPLETED |
| paymentMethod | How money was returned (recorded on completion) |
| note | Admin note |
| initiatedById | Which admin initiated the refund (auto-set to the admin who triggered the leave) |
| initiatedAt | When initiated |
| processedById | Which admin completed the refund (null while pending) |
| processedAt | When money was actually returned (null while pending) |

**Refund flow:**
1. Per-membership leave billing (see above) detects overpayment → auto-creates `Refund` with `status = PENDING`
2. Pending refunds surface in a **Pending Refunds** list for admin to process
3. Admin processes actual money transfer outside the system
4. Admin records completion: sets `amountRefunded`, `paymentMethod`, `processedById`, `processedAt`, `status = COMPLETED`

**Why `amount` and `amountRefunded` are separate:** `amount` is the calculated expected refund. `amountRefunded` is what was actually returned. They may differ (rounding, partial refund if negotiated). `amount` is set at initiation, `amountRefunded` at completion.

**No penalties:** Refund policy is straightforward — unused lessons × pricePerLesson, no deductions.

**Pending refund + student continues to next group:** When a transfer creates a PENDING refund (credit exceeded destination periods) and the student later continues to a new group (e.g., graduation), the refund stays in PENDING state — it is not automatically carried forward. The admin resolves it manually via the refund UI with two options:
- **Convert to credit:** Cancel the refund and create a transfer credit Payment on the new group's billing period.
- **Process refund:** Return the money if the student isn't continuing.

This avoids coupling the refund and graduation flows. The PENDING refund acts as a flag that "this student has money owed to them" — the admin decides based on context.

**Links to:** Student, StudentPaymentPeriod, AdminUser (initiator and processor)

---

## Teacher Payments

### TeacherPaymentPeriod
Monthly teacher pay record, per group. Generated on demand — admin triggers "generate teacher pay for month X" on the 1st of the next month.

| Field | Purpose |
|-------|---------|
| teacherId | Which teacher |
| groupId | Which group (includes both GROUP and INDIVIDUAL types) |
| periodYear / periodMonth | Which pay month |
| lessonsCompleted | How many lessons the teacher taught in this period |
| totalStudentLessons | Sum of `Lesson.activeStudentCount` across all completed lessons |
| rate | Snapshot of `groupLessonRate` or `individualLessonRate` from `TeacherRateChange` (based on `Group.type`) at period creation |
| amount | `totalStudentLessons × rate` |
| status | UNPAID → PAID |
| paidAt | When the payout was processed |
| generatedById | Which admin triggered pay generation (audit trail) |

**Unique constraint:** `(teacherId, groupId, periodYear, periodMonth)` — one pay record per teacher per group per month.

**Calculation flow:**
1. Month ends. Admin triggers pay generation for that month.
2. For each teacher, for each group they taught in:
   - Count completed lessons where `teacherId = X` and `lessonDate` in the month
   - Sum `activeStudentCount` from those lessons → `totalStudentLessons`
   - Look up the rate from `TeacherRateChange`: most recent where `effectiveFrom <= first day of month` (based on `Group.type`)
   - `amount = totalStudentLessons × rate`
3. Admin reviews, then marks PAID and records `paidAt`.

**Substitute handling:** If Teacher B substituted for Teacher A on one lesson, that lesson has `teacherId = B` and `originalTeacherId = A`. So it counts in Teacher B's pay, not Teacher A's. The `TeacherPaymentPeriod` reflects who actually taught.

**Rate change timing:** Rate is looked up from `TeacherRateChange` by `effectiveFrom` date. Admin can register a future rate change at any time — it only takes effect when `effectiveFrom <= period start`. No timing dependency on when the change is entered. `TeacherPaymentPeriod.rate` is snapshotted at generation time and is immutable after creation.

---

## Rate & Price History

### TeacherRateChange
Pay rate history for teachers. One entry per rate change. The initial rate when a teacher is first hired is the first entry.

| Field | Purpose |
|-------|---------|
| teacherId | Which teacher |
| groupLessonRate | Fixed amount per student per group lesson. Required — UI prefills with existing rate. |
| individualLessonRate | Fixed amount per student per individual lesson. Required — UI prefills with existing rate. |
| effectiveFrom | First day of the month this rate applies (date-only) |
| changedById | Which admin made the change (null for initial rate at teacher creation) |

**To find the current rate:** Most recent entry where `effectiveFrom <= today`.

**To find the rate for a billing period:** Most recent entry where `effectiveFrom <= first day of period month`.

**Scheduling future changes:** Admin creates an entry with a future `effectiveFrom`. The rate automatically takes effect when that month arrives — no timing dependency, no risk of applying the wrong rate.

**Unique constraint:** `(teacherId, effectiveFrom)` — one rate entry per teacher per effective date. To correct a rate for an existing date, update the entry rather than creating a duplicate.

**Initial entry:** Created when the teacher is first set up, with `effectiveFrom = teacher start date` and `changedById = null`.

### PriceSetting
Global lesson price settings. 4 price points based on two dimensions:
- **LevelCategory:** GENERAL (BEGINNER through UPPER_INTERMEDIATE) or IELTS
- **GroupType:** GROUP or INDIVIDUAL

| Field | Purpose |
|-------|---------|
| levelCategory | GENERAL or IELTS — derived from the group's `level` at lookup time |
| groupType | GROUP or INDIVIDUAL |
| pricePerLesson | UZS per lesson. Must be a multiple of 1,000 (Zod validation). |
| effectiveFrom | First day this price applies (date-only) |
| changedById | Which admin made the change (null for initial price seeding) |

**Lookup pattern:** to find the price for a group, derive `levelCategory` from the group's `level` (IELTS → IELTS, everything else → GENERAL), then query the most recent `PriceSetting` where `(levelCategory, groupType, effectiveFrom <= target date)`.

**Unique constraint:** `(levelCategory, groupType, effectiveFrom)` — one price per category per type per effective date. To correct a price for an existing date, update the entry rather than creating a duplicate.

**Price snapshot:** `StudentPaymentPeriod.pricePerLesson` is snapshotted from the applicable `PriceSetting` entry at period creation time. If the price changes, only future periods are affected.

**Initial entries:** Seeded when the system is set up — 4 rows covering all combinations.

---

## Promotions

### Promotion
A discount configuration. Can be percentage-based or fixed amount.

| Field | Purpose |
|-------|---------|
| type | SEASONAL, FAMILY, LOYALTY, WIN_BACK, TRIAL, EARLY_PAYMENT, PARTNER, OTHER |
| discountType | PERCENTAGE or FIXED_AMOUNT |
| discountPercent | Int, e.g. 10 for 10% off. Whole numbers only. Set when discountType = PERCENTAGE. |
| discountAmount | Int (UZS), e.g. 50000 for 50k off. Set when discountType = FIXED_AMOUNT. |
| levels[] | Empty = all levels. [BEGINNER, ELEMENTARY] = only those. |
| groupTypes[] | Empty = all. [GROUP] = group lessons only. [INDIVIDUAL] = individual only. |
| isRecurring | True for family/loyalty (applies every month) |
| recurringMonths | Null = indefinite. 3 = applies for 3 months. |
| maxUsesPerStudent | Null = unlimited. 1 = one-time. |
| maxUsesTotal | Null = unlimited. 100 = first 100 students. |
| validityDays | Null = never expires. 90 = expires 90 days after applied. |
| validFrom / validTo | Campaign window for seasonal promos. |
| code | Promo/influencer code, e.g., "ALI2026". Null for non-code promos. |

**Stacking:** All active promotions stack additively. No cap at the Promotion level, but the resulting `discountAmount` on `StudentPaymentPeriod` is clamped to `amountDue` (constraint #36) — a student never pays less than zero.

**Influencer/partner codes:** A Promotion with `type = PARTNER` and a `code`. Students sign up with the code, get the discount. Admin tracks usage count for influencer payouts.

### StudentPromotion
Links a student to a promotion. Created when a student receives a discount.

| Field | Purpose |
|-------|---------|
| appliedAt | When the promotion was given to this student |
| expiresAt | Calculated from Promotion.validityDays. Null = never. |
| monthsUsed | For recurring promos — how many months it's been applied |

### AppliedPromotion
Audit trail: which promotions actually discounted which billing period, and by how much.

| Field | Purpose |
|-------|---------|
| studentPaymentPeriodId | Which billing period |
| studentPromotionId | Which promotion |
| discountAmount | Exact amount discounted |

**Unique constraint:** One promotion can only be applied once per billing period.

---

## Referrals

### Referral
Tracks who referred whom. Rewards are handled through the Promotion system.

| Field | Purpose |
|-------|---------|
| referrerStudentId | Student A (who referred) |
| referredStudentId | Student B (who was referred) |
| status | PENDING → COMPLETED (when B makes first payment) |
| completedAt | When the referral was completed |

**Flow:**
1. Student A shares their `referralCode`
2. Student B enrolls, admin records the referral
3. Status = PENDING
4. Student B makes first payment → status = COMPLETED
5. System creates two StudentPromotions: one for A (billing credit), one for B (first-month discount)
6. Credits accumulate — a student with 10 referrals gets 10 separate StudentPromotion records

**Unique constraint:** One referral per pair, and each student can only be referred once (`referredStudentId` is `@unique`). A can't refer B twice, and B can only have one referral source.

---

## Communication History

### CallHistory
Reception follow-up calls. Used to track "did we call this lead back?"

| Field | Purpose |
|-------|---------|
| calledAt | When the call was made |
| note | What was discussed |
| calledById | Which admin made the call |

### SmsHistory
Payment reminder texts. Used to track "did we already text this parent?" and whether the message was actually delivered.

| Field | Purpose |
|-------|---------|
| phone | The actual phone number texted (student's or parent's via Family) |
| message | SMS content |
| sentById | Which admin sent it |
| status | SENT → DELIVERED or FAILED. Default SENT at creation, updated via provider callback. |
| deliveredAt | When the SMS provider confirmed delivery (null while pending or failed) |
| failureReason | Why delivery failed, if status = FAILED |
| providerMessageId | SMS provider's message ID for tracking delivery callbacks |

---

### Exam
Mid and final exams per group (both GROUP and INDIVIDUAL types). Set by the teacher based on curriculum progress.

| Field | Purpose |
|-------|---------|
| groupId | Which group (required) |
| type | MID or FINAL |
| scheduledDate | When the exam is planned |
| comment | Notes about the exam |

---

## DB-Level Constraints (raw SQL)

Only race-condition-sensitive constraints and computed-field triggers live in the DB. All validation (CHECKs) is enforced via Zod at the app level — this avoids cryptic DB errors and eliminates the need for manual SQL migrations.

Embedded in the init migration. If using `prisma db push` (which skips migrations), apply `prisma/migrations/data_integrity_constraints.sql` manually.

1. **Active membership uniqueness** — partial unique index: one active membership (`leaveDate IS NULL`) per student per group. Must be DB-level to prevent race conditions on concurrent inserts.
2. **Student.crmCode trigger** — BEFORE INSERT trigger computes `crmCode` from `sequenceNumber`. Must be DB-level for race-condition-free ID generation.
3. **Group.publicId trigger** — BEFORE INSERT trigger computes `publicId` (e.g., "GR-1", "IND-3") from `type` + `sequenceNumber`. Same reason.
4. **Current group teacher uniqueness** — partial unique index: one current teacher (`endDate IS NULL`) per group in `GroupTeacherHistory`. Same race-condition rationale as #1 — concurrent permanent teacher changes could both create "current" records without DB enforcement.

**Validations enforced via Zod (moved from DB CHECKs):**
- Promotion discount has exactly one type (discountPercent XOR discountAmount)
- No self-referral (referrerStudentId != referredStudentId)
- Reschedule requires billing origin (rescheduledFromId set → originalLessonId required)
- Cancellation requires reason + admin (cancelledAt set → cancellationReasonId + cancelledById required)
- Merge/graduation mutual exclusivity (mergedIntoGroupId and graduatedIntoGroupId cannot both be set)
- Group endDate > startDate
- Payment.amount > 0, Refund.amount > 0
- StudentPaymentPeriod amounts >= 0, TeacherPaymentPeriod.amount >= 0

## Application-Level Constraints

These are documented at the top of `schema.prisma`:

1. **Student.phone uniqueness** — enforced at DB level (`@unique`). May need to relax later if siblings share a parent's phone.
2. **Trial membership staleness** — persistent visual alert for any unresolved trial memberships (`isTrial = true AND joinDate < today`). Admin must confirm immediately after the trial class.
3. **Group.maxStudents** — enforce in transaction before adding membership. Default 6 for GROUP type, 1 for INDIVIDUAL type.
4. **TeacherScheduleSlots are per-date** — pre-created alongside Lesson records when a group is created. Not synced with Group.days (days defines the pattern; slots are the actual dates). Same transaction rule applies for Attendance.groupId (denormalized from Lesson.groupId).
5. **Exam duplicates** — validate in UI if a group already has an exam of the same type.
6. **Price must be a multiple of 1,000** — validate `pricePerLesson` on `PriceSetting` (Zod: `z.number().int().multipleOf(1000)`). This guarantees that `price × discountPercent / 100` always produces a whole number, keeping the entire billing chain as pure integer math with zero rounding.
7. **Minor enrollment requires Family** — when creating a student whose dateOfBirth makes them under 18 at enrollment time, familyId must be set.
8. **Lesson pre-creation** — when creating a group, generate all Lesson records and TeacherScheduleSlots from startDate through endDate, skipping holidays. Each Lesson gets `teacherId` and `originalTeacherId` from the group's teacher, startTime denormalized, status SCHEDULED.
9. **Cancellation flow** — mark Lesson status CANCELLED + set `cancelledAt`, `cancelledById`, and `cancellationReasonId` (plus `otherCancellationReason` if reason is "Other"), delete its TeacherScheduleSlot, create a replacement Lesson at the next valid date after current endDate (with rescheduledFromId pointing to the cancelled one), create a new TeacherScheduleSlot for the replacement, update Group endDate to the new last lesson date.
10. **Group merge** — allowed for both GROUP and INDIVIDUAL types. Set `mergedIntoGroupId` on the absorbed group, set `isActive = false`, set `leaveDate` on all active memberships (triggers per-membership leave billing #31 — overpayment becomes transfer credit, not refund), create new memberships in the surviving group (with `previousMembershipId` linking to the old one, triggers billing period pre-creation #32).
11. **Teacher deactivation** — before setting `Teacher.isActive = false`, reassign each of the teacher's active groups to a different teacher individually. Update all future SCHEDULED lessons and their TeacherScheduleSlots for each reassigned group. Do not deactivate a teacher with unresolved active groups.
12. **Group.days validation** — only `[1,3,5]` (Mon/Wed/Fri) or `[2,4,6]` (Tue/Thu/Sat) are valid day patterns. Validate with Zod at the app level.
12a. **Group.durationMinutes validation** — only 60 or 80 are valid. Validate with Zod (`z.union([z.literal(60), z.literal(80)])`). The schedule slot conflict detection assumes lessons fit within the 90-minute grid spacing.
12b. **Group.days immutability** — `days` cannot be changed after group creation. All Lessons and TeacherScheduleSlots are pre-created based on the day pattern (#8). Changing days would invalidate every existing lesson date. If a day pattern change is needed, create a new group with the correct days and transfer students.
13. **Group.startTime change** — when updating a group's startTime, programmatically update all future SCHEDULED lessons' `startTime` and their TeacherScheduleSlots in the same transaction.
14. **Teacher rate and lesson price changes** — teacher rates tracked in `TeacherRateChange`, lesson prices tracked in `PriceSetting` (global, keyed by `levelCategory` + `groupType`). Both use `effectiveFrom` dates. When generating `TeacherPaymentPeriod` or `StudentPaymentPeriod`, look up the rate/price from the most recent entry where `effectiveFrom <= period start date`. Snapshots on the payment period are immutable after creation. Initial teacher rate is recorded as the first history entry when a teacher is created. Initial prices are seeded in `PriceSetting`.
15. **StudentPaymentPeriod manual editing** — admin can manually adjust `amountDue`, `totalLessons`, `discountAmount` for error correction. Always recalculate `paymentStatus` from `amountPaid` vs `amountDue - discountAmount` using a single helper function.
16. **paymentStatus sync** — never update `amountPaid` or `paymentStatus` independently. Use a single helper that computes status from `amountPaid` vs `amountDue - discountAmount` and updates both fields atomically.
17. **lostReasonId and Student.status coupling** — setting `lostReasonId` requires `status = INACTIVE` (with `inactivatedAt` and `inactivatedById` set). Setting `status = INACTIVE` requires `lostReasonId`. Enforce in application code.
18. **Attendance pre-creation** — for each lesson, attendance records are created for all active group members (`leaveDate IS NULL`) with `isAbsent = false`. Teacher updates `isAbsent` during or after the lesson. `isAbsent` does NOT affect student active/inactive status.
19. **Group.endDate > Group.startDate** — validate with Zod at the app level.
20. **TeacherAvailability overlap** — validate in application code that a teacher's availability blocks for the same `dayOfWeek` don't overlap in time.
20a. **TeacherUnavailability overlap** — validate in application code that a teacher's unavailability records for the same date don't have overlapping time ranges. A whole-day entry (`startTime IS NULL`) conflicts with any other entry on the same date.
21. **Permanent teacher change** — when a group's teacher is permanently changed (not a one-off substitution): update `Group.teacherId`, close the current `GroupTeacherHistory` record (set `endDate`), create a new one, and update ALL future SCHEDULED lessons' `teacherId` AND `originalTeacherId` to the new teacher. Swap `TeacherScheduleSlots` for those lessons. This ensures `teacherId != originalTeacherId` on a Lesson always means a substitution, never a permanent reassignment.
22. **mergedIntoGroupId** — allowed for both GROUP and INDIVIDUAL types. GROUP merge: two small groups at the same level combine. INDIVIDUAL merge: two 1-student individual arrangements combine into one 2-student individual group.
23. **Group graduation** — admin triggers when a group's program ends (no SCHEDULED/PENDING_RESOLUTION lessons remain). Creates a new group at the next level (same teacher, days, time; price determined by `PriceSetting`). Admin selects continuing students. Creates memberships with `previousMembershipId` (triggers billing period pre-creation per #32). Auto-updates `Student.level` for continuing students. Closes old group: `isActive = false`, `graduatedIntoGroupId` set, `leaveDate` set on all active memberships (for record-keeping only — billing periods are already finalized since all lessons are COMPLETED/CANCELLED; does NOT trigger per-membership leave billing #31). Skip if `skipAutoGraduation = true` or `level = IELTS`.
24. **Level progression order** — BEGINNER → ELEMENTARY → PRE_INTERMEDIATE → INTERMEDIATE → UPPER_INTERMEDIATE → IELTS. IELTS has no next level.
25. **Transfer billing** — when a student transfers mid-month with unused paid lessons: adjust Group A's billing period (audit trail via `PaymentPeriodAdjustment`), create a `Payment` on Group B's period with `isTransferCredit = true` and the credit amount. Recalculate `paymentStatus` on both periods.
26. **Individual lesson student cancellation** — students in INDIVIDUAL groups may cancel lessons: max 2 per calendar month, min 24h advance notice. Late cancellation (< 24h) = lesson counts as delivered, no reschedule. Count by querying CANCELLED lessons for the student's individual group in the current month where `cancellationReasonId` = "Student request". Group lessons do NOT allow student cancellations.
27. **Individual lesson offline reschedule** — when student and teacher agree to move an individual lesson to a different time: set `originalDate`/`originalStartTime` to preserve old values, update `lessonDate`/`startTime`, delete old TeacherScheduleSlot and create new one. Does NOT count toward cancellation limit. Not applicable to group lessons.
28. **TeacherUnavailability auto-detection** — when a TeacherUnavailability record is created, query all SCHEDULED lessons for that teacher on the affected date (matching time range if `startTime`/`endTime` are set). Set those lessons to `PENDING_RESOLUTION` with `pendingAt = now()`. Validate no duplicate unavailability entries for same teacher+date+time (app-level).
29. **PENDING_RESOLUTION alert** — persistent visual indicator (like stale trials) for lessons `WHERE status = 'PENDING_RESOLUTION'`, ordered by `pendingAt` ascending (oldest unresolved first). Resolution: assign a substitute (swap schedule slot, status → SCHEDULED, clear `pendingAt`) or cancel + append. Schedule slot is KEPT during PENDING_RESOLUTION and only cleaned up at resolution time.
30. **Absence policy** — group lessons: no freezes, no free absences, student pays regardless. Individual lessons: student cancellation allowed per constraint #26. Only teacher-initiated cancellations (via TeacherUnavailability) result in free rescheduling for group lessons.
31. **Per-membership leave billing** — triggered when `leaveDate` is set on a GroupMembership mid-program (dropout, transfer, or merge). **NOT triggered for graduation** — at graduation all lessons are already COMPLETED/CANCELLED and billing periods are finalized (see #23). (a) Current month's `StudentPaymentPeriod` — reduce `totalLessons` to lessons up to leaveDate, recalculate `amountDue`, create `PaymentPeriodAdjustment`. (b) Future months' periods — hard-delete (untouched, UNPAID, no payments/adjustments/promotions). (c) Recalculate `paymentStatus`. (d) Handle overpayment based on leave type: **Transfer** (`transferReasonId` set) or **Merge** (`group.mergedIntoGroupId` set) → do NOT create a Refund, instead create a `Payment` with `isTransferCredit = true` on the new group's billing period (#25). **Dropout / other** → if `amountPaid > (amountDue - discountAmount)`, auto-create a `Refund` with `status = PENDING`. (e) Pending refunds surface in a Pending Refunds list. Note: student goes INACTIVE only when ALL active memberships end — a student can leave one group while staying ACTIVE in others.
32. **Billing period pre-creation** — when a GroupMembership is created (and `isTrial = false`), generate `StudentPaymentPeriod` records for each month from `joinDate` through group `endDate`. Count pre-created Lessons per month, snapshot `pricePerLesson` from `PriceSetting` (derive `levelCategory` from group level), `amountDue = totalLessons × pricePerLesson`. Apply active promotions: query the student's active `StudentPromotion`s, calculate `discountAmount` per period, create `AppliedPromotion` records, and set `discountAmount` on each period. For recurring promos, increment `monthsUsed` and check `recurringMonths` / `expiresAt`. First month: `isPartialPeriod = true` if joining after the 1st. Trial students (`isTrial = true`): do NOT create periods — create them when the student commits (`isTrial` → `false`), using the original `joinDate`. This makes the No Payment List purely query-based.
33. **Student.level auto-update on graduation** — when a student moves to a graduated group (#23), update `Student.level` to match the new group's level. App-level warning (not constraint) if manually assigning a student to a group with a different level.
34. **Time format validation** — all time String fields must be in `HH:mm` format (24-hour, zero-padded). Validate with Zod: `z.string().regex(/^\d{2}:\d{2}$/)`. Applies to: `Group.startTime`, `Lesson.startTime`, `Lesson.originalStartTime`, `TeacherAvailability.startTime/endTime`, `TeacherScheduleSlot.startTime`, `TeacherUnavailability.startTime/endTime`. `Student.preferredTimeSlots` uses the fixed TIME_SLOTS enum instead. Inconsistent format (e.g., "9:00" vs "09:00") would break the `TeacherScheduleSlot` unique constraint and lexicographic time comparisons.
35. **Family.parentPhone dedup** — when creating a Family, search for existing families with the same `parentPhone`. If found, warn the admin: "A family with this phone already exists — link to it instead?" Prevents duplicate Family records for the same parent. Not a hard constraint (different guardians could theoretically share a phone), just a UI warning.
36. **Discount cap** — when applying promotions during billing period creation (#32) or manual editing (#15), clamp total `discountAmount` to `amountDue`. Promotions stack additively with no cap at the Promotion level, but the resulting `discountAmount` on `StudentPaymentPeriod` must never exceed `amountDue`. Otherwise `amountDue - discountAmount` goes negative, making `paymentStatus` always PAID and producing nonsensical billing data. Validate with Zod: `discountAmount <= amountDue`.
37. **activeStudentCount snapshot timing** — when marking a Lesson COMPLETED, set `activeStudentCount` to the count of active group members (`leaveDate IS NULL` on GroupMembership) as of `lessonDate`, NOT as of the moment the teacher clicks "complete." If there's a delay between the lesson and completion marking, a student may have left in between — the count should reflect who was enrolled when the lesson actually happened.

---

## Indexing Strategy

The schema ships with indexes on the most obvious FK columns and query patterns. **As we implement the application, watch for missing indexes** — the right set of indexes depends on the actual queries each feature runs. Signs you need a new index:

- A list/table page feels slow (likely a missing index on the filter or sort column)
- A query does a sequential scan on a large table (check with `EXPLAIN ANALYZE`)
- You add a new filter or search feature (e.g., filtering students by level+status needs a composite index)

**Rule of thumb:** every `WHERE` clause column and every `JOIN` FK column should have an index, unless the table is small (<1000 rows) or the column is already covered by a unique constraint.

---

## Teacher Unavailability

### TeacherUnavailability
One-off unavailability for specific dates — sick days, personal days, appointments. Separate from `TeacherAvailability` (recurring weekly pattern).

| Field | Purpose |
|-------|---------|
| teacherId | Which teacher |
| date | Specific date (date-only) |
| startTime | Null = whole day. "08:00" = start of unavailable block. |
| endTime | Null with startTime set = from startTime onwards. "13:00" = end of block. |
| reason | Free text, e.g., "Sick", "Doctor appointment" |
| createdById | Which admin recorded this |

**Time range logic:**
- `startTime null, endTime null` → whole day (sick, traveling) → affects all lessons that day
- `startTime "08:00", endTime "13:00"` → morning block → lessons from 13:00 onwards are fine
- `startTime "16:00", endTime null` → from 16:00 onwards (rest of day)

**Multiple blocks per day:** Allowed — one record per unavailable block. Teacher unavailable at 10:00 and 14:00 but free at 12:00 → 2 records.

**Automatic detection flow:**
1. Admin records unavailability for Teacher X on a date
2. System queries all SCHEDULED lessons for that teacher on affected dates (matching time range)
3. Those lessons are set to `PENDING_RESOLUTION` with `pendingAt = now()`
4. Admin sees them in a Pending Resolution alert (persistent, like stale trials)

**Resolution options:**
- **Assign substitute:** swap schedule slot (delete old, create for sub), set lesson status back to SCHEDULED, clear `pendingAt`
- **Cancel + append:** standard cancellation flow (CANCELLED, slot deleted, replacement at end of program)

**Schedule slot during PENDING_RESOLUTION:** Kept (not deleted). This prevents accidentally booking another group in that teacher's time while the lesson is still unresolved. Cleaned up only at resolution time.

**Links to:** Teacher, AdminUser (who recorded it)

---

## Absence & Cancellation Policy

### Group Lessons
No freezes, no free absences. Student pays for every lesson in the billing period regardless of attendance (`isAbsent` is tracking-only). The only exception is teacher-initiated cancellations (via TeacherUnavailability → PENDING_RESOLUTION), which are always rescheduled — student never loses a paid lesson.

### Individual Lessons
Students may cancel lessons, subject to limits:
- **Max 2 cancellations per calendar month** — counted by querying CANCELLED lessons for the student's individual group where `cancellationReasonId` = "Student request"
- **Min 24 hours advance notice** — late cancellation (< 24h before lesson) = lesson counts as delivered, no reschedule
- **Cancel + append flow:** same as teacher cancellation — lesson CANCELLED, schedule slot deleted (teacher IS free), replacement appended at end of program
- **Offline reschedule alternative:** if student and teacher agree on a different time, the lesson is moved (not cancelled). Does NOT count toward cancellation limit.

### Schedule Slot Behavior Summary

| Scenario | Slot deleted? | Teacher free? |
|---|---|---|
| Student cancels individual lesson | Yes | Yes (no student to teach) |
| Teacher unavailable → PENDING_RESOLUTION | No (kept until resolved) | No (unavailability blocks) |
| Resolution: substitute assigned | Old deleted, new for sub | Original teacher still unavailable |
| Resolution: cancel + append | Old deleted, new at end | Original teacher still unavailable |

