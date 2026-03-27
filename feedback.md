<!-- TODO -->
1. [DONE] refund - calculate the price for the first trial lesson - for full price
2. [exists_already???] но пеймент добавить общую сумму remaining value
3. регистрировать academic support и прикреплять к группам
4. LANGUAGE_HARD_LEVELS

5. When transferring students(possibly other actions as well) we rely on the "completed" lessons count to know how many lessons the student has taken(later logic builds on top of this count if i recall correctly) - what happens if teacher/admin forgot to complete a lesson though?

6. what happens if student has exhausted his free trials? 
- he should still have a trial lesson but he's no longer eligible for a trial lesson discount


let's please double check our refund implementation - i think we've missed something in the implementation. Let's take this scenario for example:
- there are 12 lessons in a given month
- student A joins at the first lesson of the month and takes a trial lesson in a GROUP lesson
- trial lessons in a GROUP are free
- lessons in a GROUP cost 100000 uzs each
- the student liked the lesson and is ready to commit, he commits
- student then makes a payment for the remaining 11 lessons in the month
- after taking the second lesson however student for some reason decideds he no longer wants to take classes with us and we have to refund the student
- since first lesson was free and student has paid for 11 lessons and he only took 1 besides the trial lesson - we should refund him for that 1 lesson, correct? - i think currently that's not what we do - we refund the student for both the trial lesson and the first lesson after the trial - please double check that


# Feedback Items

---

## 1. "Add student" button on reception tab

**Current:** Reception page (`/reception`) only shows students with status `AWAITING_ASSIGNMENT`. To create a new student, admin must navigate to `/students/new` manually.

**Change:** Add a button (e.g. "Add Student") at the top of the reception page that navigates to `/students/new`. This is a convenience shortcut — the reception tab is where admins spend most of their time, and new students arriving from amoCRM need to be entered quickly.

---

## 2. "First Lessons" list

**Current:** Trial students only appear inside their assigned group's detail page. There is no centralized view of students who are about to have (or just had) their first trial lesson.

**Change:** Add a "First Lessons" section/list to the reception page showing all trial students (`isTrial=true`, `leaveDate IS NULL`) with an upcoming or recent lesson. Columns: student name, group name (publicId), lesson date/time, attended (yes/no toggle based on attendance records). **Workflow:** Admin sees a student attended their trial → calls the student to ask if they want to commit → resolves (commit/leave/reassignment). Once resolved, the student disappears from this list. If committed and unpaid, they move to the "Second Lessons" list below.

---

## 3. "Second Lessons" list

**Current:** There is no view showing recently-committed students who haven't paid yet. The No Payment list (`/payments`) shows all unpaid periods for the current month, not specifically new students.

**Change:** Add a "Second Lessons" section/list to the reception page showing students who: committed from a trial (`wasTrialOriginally=true`, `isTrial=false`) AND have unpaid billing for their current month. Columns: student name, group name, lessons attended (count from attendance records), payment status. **Escalation:** If a student has attended 2+ lessons but still hasn't paid, highlight the row red — this is urgent. The student can still attend classes, but the admin needs to decide whether to deactivate or send to reassignment. Once the student pays, they disappear from this list.

---

## 4. Phone number search filter (reception + students)

**Current:** Reception table and students table both search by name only (placeholder: "Search by name..."). The No Payment table already supports searching by name + phone + parent phone.

**Change:** Extend the search filter on both `/reception` and `/students` tables to also match against `student.phone` and `family.parentPhone`. Same pattern as the No Payment table — admin types a phone number, all matching students appear.

---

## 5. Comment column font color on reception

**Current:** The comment column in the reception table uses `text-muted-foreground` (gray, low contrast). Comments are easy to miss.

**Change:** Change the comment column to a more visible color (e.g. `text-foreground` or a distinct color that stands out). Comments are operationally important when they exist — admin needs to see them at a glance. Only the reception table needs this change.

---

## 6. Promo code "not found" error

**Current:** When creating a student, the admin can enter a promo code. If they accidentally enter another student's referral code (which is a different promotion type, not a `PROMO_CODE`), the system returns `"Promo code 'X' not found"` — even though the code exists as a referral code. The error message is confusing.

**Change:** Improve the error to distinguish between "code doesn't exist" and "code exists but is a referral code, not a promo code." For example: `"Code 'X' is a referral code — use the referral field instead"` vs `"Promo code 'X' not found"`. The lookup in `createStudent()` (actions/students.ts) queries `promotion.findUnique({ where: { code } })` — if found but `type !== PROMO_CODE`, return a specific message.

---

## 7. Promotion section: only Apology/Reward with comment

**Current:** The "Add Promotion" dialog on the student detail page shows a dropdown of all promotions (SEASONAL, FAMILY, WIN_BACK, TRIAL, PROMO_CODE, etc.). Most of these are auto-applied and should never be manually assigned. The dialog has no comment/reason field.

**Change:** Filter the promotion dropdown to only show `APOLOGY` and `REWARD` type promotions — everything else is auto-applied. Add a required comment/reason textarea field to the assign dialog. When assigning an apology discount, admin must explain what they're apologizing for. When assigning a reward, admin must explain what the reward is for. This comment should be stored (likely on `StudentPromotion` — may need a `comment` field added to the model) and displayed wherever promotions are shown.

---

## 8. Zod validation error: "YYYY-MM-DD" → "DD-MM-YYYY"

**Current:** Date validation helpers in `schemas/helpers.ts` show the error message `"Must be YYYY-MM-DD"`. The UI date inputs actually display dates in DD-MM-YYYY format (via `toLocaleDateString("en-GB")`), so the error message contradicts what the user sees.

**Change:** Update the error message string in `requiredIsoDate()` and `nullableIsoDate()` helpers to say `"Must be DD-MM-YYYY"`. Also check the rate change schema in `schemas/teacher.ts` which has the same message. The underlying storage format stays ISO (YYYY-MM-DD) — only the user-facing error text changes.

---

## 9. Age column on student lists

**Current:** Student tables (reception, students page, group detail student list) show DOB only on the student detail page. No age is calculated or displayed anywhere in tables.

**Change:** Add an "Age" column to all student list views (reception table, students table, group detail student list). Calculate age from `dateOfBirth` relative to today. Display as a simple number (e.g. "14", "23"). Useful for admin to quickly assess student demographics without opening each profile.

---

## 10. Teacher availability redesign (MWF/TTS patterns)

**Current:** The availability editor shows all 7 days (Mon–Sun) independently. Each day can have multiple time ranges (e.g. 14:00–16:00, 18:00–20:00). Time is a free-form input, not aligned with the group time slots.

**Change:**
- Replace per-day selection with pattern selection: **MWF** (Mon/Wed/Fri) or **TTS** (Tue/Thu/Sat). Remove Sunday entirely (no classes on Sunday).
- When a teacher selects a time range for MWF, that same range applies to all three days (Mon, Wed, Fri). Same for TTS. No per-day time differences within a pattern — classes are scheduled at the same time for all days in a pattern.
- Change time selection to use the same time slots as group creation (the `TIME_SLOTS` constant: 7:00, 8:30, 10:00, 11:30, 13:00, 14:30, 16:00, 17:30, 19:00, 20:30, 22:00). Both start and end time should be selectable from these slots.
- Apply the same time slot alignment to **teacher unavailability** (`unavailability-section.tsx` / `unavailability-form.tsx`).

**Technical notes (from analysis):**
- **No schema changes needed.** `TeacherAvailability` stores `dayOfWeek` + `startTime` + `endTime` — the MWF/TTS pattern is a UI grouping; DB still stores individual day records (e.g. MWF 14:00–16:00 = 3 rows with dayOfWeek 1, 3, 5).
- **No action changes needed.** `setAvailability` already accepts an array of blocks and replaces them all in a transaction.
- **Scope is UI-only:** rewrite `availability-editor.tsx` (pattern buttons + TIME_SLOTS selects instead of per-day checkboxes + free-form time inputs) and swap time inputs in `unavailability-form.tsx`. **Actual size: Medium, not Large.**

---

## 11. Schedule → teacher details navigation

**Current:** In the schedule grid (`schedule-grid.tsx`), teacher names in the left column are plain text. No way to navigate to a teacher's detail page from the schedule.

**Change:** Wrap teacher names in a `<Link>` to `/teachers/[id]`. Teacher name becomes clickable — clicking navigates to the teacher detail page. Same style as other navigable names in the app (e.g. student names in reception table).

---

## 12. Rate history editing + validation

**Current:** The rate history section on teacher detail page only allows adding new rate records. Existing records cannot be edited. Rate inputs accept any number with no min/max validation.

**Change:**
- Add an "Edit" button on each rate history row that opens an edit form (inline or dialog) to update `groupLessonRate` and `individualLessonRate` for that record.
- Add validation to both rate inputs: minimum 1, maximum should be capped at the corresponding `PriceSetting` value (i.e. group rate max = current group price from PriceSetting, individual rate max = current individual price). This prevents entering a teacher rate higher than what the student pays.
- Add a "Delete" button on **UNPAID** `TeacherPaymentPeriod` records so admin can delete a wrong payment record and regenerate with the corrected rate.

**Technical notes (from analysis):**
- **Rate is snapshotted** into `TeacherPaymentPeriod.rate` and `amount` at generation time. Editing a rate does NOT retroactively change already-generated payments.
- **Regeneration is safe** because `generateTeacherPay` uses `createMany({ skipDuplicates: true })`. After deleting an UNPAID record, "Generate Pay" recreates only the missing record with the corrected rate — all other teachers' records are skipped.
- **PAID records must never be deleted** — they represent actual money paid and serve as the audit trail.
- **Correction flow:** admin edits rate → deletes the UNPAID payment record → clicks "Generate Pay" → record is recreated with the new rate.

---

## 13. Resolve button only visible after attendance

**Current:** Already implemented. The Resolve button in the trial resolution dialog is gated by `hasAttendance` — it's disabled until attendance is recorded for the trial student.

**Status:** Done. No changes needed.

---

## 14. Trial no-show handling + new resolution paths

**Current:** Trial students in the group detail student list only have a "Resolve" button that opens a dialog with "Commit" and "Didn't continue" options. "Didn't continue" requires attendance, so no-show students (who never attended) are stuck with no resolution path. There's also no "Send to Reassignment" button for trial students.

**Change:** Add different action buttons depending on whether the trial student has attendance:

**Trial student WITH attendance:**
- Resolve button (existing) → commit / send to lost list (renamed from "didn't continue")
- Send to Reassignment button (new)

**Trial student WITHOUT attendance (no-show):**
- Send to Lost button (new) — deactivates with appropriate lost reason (seeded: "Trial no-show (Group)", etc.)
- Send to Reassignment button (new) — sets `AWAITING_REASSIGNMENT` status
- Transfer Trial button (new) → opens a group picker dialog to move the student to a different group for another trial attempt

**New server action: `transferTrialStudent`** — lightweight, separate from `transferStudent` (no billing). Steps:
1. Validate: membership exists, `isTrial=true`, no `leaveDate`
2. Close source membership: set `leaveDate`, `leaveReasonId` (trial no-show reason)
3. Call `addStudentsToGroup` for destination group — auto-trial logic determines if student gets another free trial
4. No billing adjustments (trial = no billing periods)

Note: `sendToLost` and `sendToReassignment` already work for trial students — they just need UI buttons wired up.

---

## 15. Rename "Didn't continue" → "Send to Lost list"

**Current:** The trial resolution dialog has a button labeled "Didn't continue" which deactivates the student and sets a lost reason. The label doesn't clearly communicate what happens.

**Change:** Rename the button from "Didn't continue" to "Send to Lost list" — this is what the action actually does (student becomes INACTIVE and appears on the Lost List page). Update in `trial-resolution-dialog.tsx`.

---

## 16. Show remaining amount on No Payment list & group details

**Current:** The No Payment table shows "Due" and "Paid" columns but no "Remaining" column. The group detail student list shows a "Lessons Paid" status badge but not the remaining amount. The payment history component (student detail page) already calculates and displays remaining — this logic just needs to be surfaced in the two missing places.

**Change:**
- **No Payment table:** Add a "Remaining" column showing `amountDue - discountAmount - amountPaid`. Highlight in red if > 0.
- **Group detail student list:** Add a column (or inline display) showing remaining amount for students with partial/unpaid payments for the current month. This helps admin see at a glance who owes money within a specific group.

---

## 17. Payments tab (paid payments list + filters)

**Current:** The `/payments` page only shows the "No Payment List" (unpaid periods for current month). There is no view of completed payments — no way to see when payments were made, by which method, etc.

**Change:** Add a new payments view (either a tab on the payments page or a separate page) that lists **paid payments** (records from the `Payment` table where a payment was actually recorded). Key columns: student name, CRM code, amount, payment method, payment date (when the payment was recorded), recorded by (admin who recorded it), group, billing period.

Filters needed:
- Date range filter (specific date, month, year)
- Payment method filter (click, payme, cash, bank transfer)

Also: add "Bank transfer" as a new payment method to the `PaymentMethod` enum in the Prisma schema. This requires a migration.

---

## 18. Teacher file uploads

**Current:** No file upload infrastructure exists. No `TeacherDocument` model in the schema. Teacher detail page has profile info, availability, rates, trial history, and pay history — but no documents section.

**Change:** Implement teacher file uploads for contracts and passport documents. Requires:
- New `TeacherDocument` model: `teacherId`, `type` (CONTRACT/PASSPORT/OTHER), `fileName`, `fileUrl`, `uploadedAt`, `uploadedById`
- File storage infrastructure (S3 or Cloudflare R2)
- Upload API endpoint
- UI on teacher detail page: document list with upload, download, and delete actions

This was scoped for "Later" in the implementation plan but is being moved up in priority.

---

## 19. Language/level mismatch: error → warning

**Current:** When assigning a BEGINNER or ELEMENTARY student to a group where the teacher can't teach in the student's preferred language, the system returns a hard error: `"Student X requires [LANGUAGE] instruction at [LEVEL] level, but this group's teacher cannot teach in [LANGUAGE]"`. For PRE_INTERMEDIATE+, language is a soft preference (sorting only, no blocking). On the client side, incompatible groups are completely filtered out of suggestions for BEGINNER/ELEMENTARY students.

**Change:** Convert the hard error to a warning for ALL levels. The server action (`addStudentsToGroup`) should allow the assignment but return a warning. The assign dialog should show incompatible groups in the suggestions (not filter them out) but with a visual warning indicator. Admin can still choose to assign — the warning is informational, not blocking. This gives admin flexibility for edge cases where a mismatched teacher is the only option.

---

## 20. Reassignment doesn't remove student from group (BUG)

**Current:** `sendToReassignment()` in `actions/students.ts` only updates `student.status` to `AWAITING_REASSIGNMENT`. It does NOT set `leaveDate` on the student's active group memberships. The student remains visible in the group's student list as an active member.

**Change:** When sending a student to reassignment, also close all their active group memberships by setting `leaveDate = today` on all memberships where `leaveDate IS NULL`. This should also trigger leave billing (call `performLeaveBilling` from `helpers/leave-billing.ts`) to prorate the current month and delete future billing periods — same as what happens during a transfer. The student should immediately disappear from the group's active student list.

---

## 21. Block future-month payments + cap at amount due

**Current:** The `recordPayment` action in `actions/payments.ts` has no validation on which billing period can receive a payment, and no cap on the payment amount. The UI pre-fills the remaining balance but admin can override with any number. We've had an incident where admin recorded a payment of 2,000,000 UZS when only 300,000 was due.

**Change:**
- **Block future payments:** Add validation in `recordPayment` to reject payments for billing periods where `periodYear/periodMonth` is in the future (after the current month). Only current month and past months can receive payments.
- **Cap payment amount:** Add validation that `amount <= remaining` (where `remaining = amountDue - discountAmount - amountPaid`). If admin enters more than what's due, return a validation error. Also add a `max` attribute on the amount input field in the record payment dialog.
- Update the payment schema in `schemas/payment.ts` with these constraints.

---

## 22. Group creation: start date minimum today

**Current:** The group creation form (`schemas/group.ts`) validates `startDate` as a required ISO date but has no minimum date check. The HTML date input has no `min` attribute. Admin can create groups with past start dates.

**Change:** Add a Zod refine to `groupCreateSchema` that rejects `startDate` before today. Also add `min={new Date().toISOString().split('T')[0]}` to the date input in `group-form.tsx`. Error message: "Start date cannot be in the past".

---

## 23. Active/deactivated teacher filter

**Current:** The teachers page (`/teachers`) only shows active teachers. `getTeachers()` query filters with `where: { isActive: true }`. Once a teacher is deactivated, they disappear from the UI entirely. There's a `getAllTeachers(includeInactive)` function that exists but is never used.

**Change:** Add a filter toggle/dropdown on the teachers page to switch between "Active" (default), "Deactivated", or "All" teachers. Use the existing `getAllTeachers()` query function. Deactivated teachers should be visually distinct (e.g. greyed out row, or a "Deactivated" badge).

---

## 24. Uncertain reason dialog

**Current:** The uncertain toggle on the group detail student list is a simple button click (Yes/—) that calls `toggleUncertain(studentId, true/false)`. No dialog, no reason input. The `uncertainComment` field on the Student model exists but is never set from the UI — it's auto-cleared when toggling off.

**Change:** When marking a student as uncertain, show a dialog with:
- A reason dropdown (list of reasons — to be provided from "Таблица_индикаторов_оттока_учеников.xlsx", plus an "Other" option)
- If "Other" is selected, show a textarea for free-text reason
- The selected reason should be stored in `uncertainComment` (or a new `uncertainReasonId` field if we want structured reasons)
- The reason is displayed on the uncertain page next to the student

Note: The reason list will be supplied separately. May need a new `UncertainReason` reference table in the schema, similar to `LostReason` / `TransferReason`.

---

## 25. Uncertain page actions

**Current:** The uncertain page (`/uncertain`) is a read-only list showing uncertain students with: CRM, name, phone, level, groups, flagged by, comment. No actions available — admin must navigate to the student's group detail page to toggle the flag off.

**Change:** Add action buttons on each row of the uncertain page:
- **Remove uncertain mark** — clears `isUncertain` flag. Should preserve history (when the student was marked uncertain, what the reason was, when it was resolved). May need an `UncertainHistory` model or similar to track this.
- **Send to reassignment** — calls existing `sendToReassignment` action
- **Transfer** — opens the transfer dialog (same as group detail page)
- **Send to lost list** — deactivates with lost reason selection

---

## 26. Effective date for actions [DONE]

**Current:** All actions (transfer, send to lost, send to reassignment, merge groups) execute immediately with `new Date()` as the timestamp. No way to schedule an action for a future date or backdate.

**Change:** Add an optional "effective date" field to these actions:
- Transfer student
- Send to lost list (deactivate)
- Send to reassignment
- Merge groups

**Technical implications to discuss:** If an action is scheduled for a future date, should it execute immediately but use the future date for billing calculations (e.g. leaveDate = future date, so billing runs until that date)? Or should it be truly deferred (stored as pending and executed on the date)? The first approach is simpler — it's really just a date override. The second requires a scheduling system. Let's discuss which approach fits the operational reality better.

---

## 27. Student page → group details navigation

**Current:** Already implemented. Both "Active Groups" and "Group History" sections on the student detail page have clickable group publicId links that navigate to `/groups/[id]`.

**Status:** Done. No changes needed.

---

## 28. Comments audit (research)

**Current:** Comments exist in these places:
- **Student.comment** — set during student creation/edit, shown on student detail page under "Notes"
- **GroupMembership.comment** — set when adding a student to a group, shown in group detail student list (truncated column)
- **Student.uncertainComment** — set when marking uncertain (currently auto-cleared on toggle, see item #24)
- **PaymentPeriodAdjustment** — has a `reason` field (required), shown in payment history
- **Payment.note** — optional note when recording a payment

**Not present on:** promotions (StudentPromotion), refunds, transfers, or general-purpose action logs.

**Research question:** Should we add a dialog to edit comments inline (click → popover/dialog → edit → save) rather than navigating to edit pages? If so, which comment locations need this? This is a UX research item — let's decide the scope before implementing.

---

## 29. Exam dates (auto-calculated) + Exams page

**Current:** The `Exam` model exists in the schema (`groupId`, `type` (MID/FINAL), `scheduledDate`, `comment`) but has zero UI. No exams are created, displayed, or managed anywhere in the admin panel.

**Change:**
- **Auto-calculate on group creation:** When creating a group, auto-calculate and create two Exam records:
  - **Mid exam:** lesson number = `Math.floor(totalLessons / 2)` → use that lesson's date
  - **Final exam:** 3rd lesson from the end → use that lesson's date
- **Display on group detail page:** Show mid exam and final exam dates in the group header/info section.
- **Exams page** (`/exams`): New sidebar tab showing all exam dates (both mid and final) across all groups. Table columns: group publicId, exam type (Mid/Final), date, teacher. Filter by month.

---

## 30. Lessons count by month instead of total

**Current:** Group detail page header shows `"36 total"` in the Lessons section — just a single number.

**Change:** Replace the single total with a monthly breakdown. For example:
- March — 5 lessons
- April — 12 lessons
- May — 12 lessons
- June — 7 lessons

Query the pre-created lessons grouped by `EXTRACT(MONTH FROM lessonDate)` and display as a small list/column. The total can still be shown as a summary line below.

---

## 31. Holidays management tab

**Current:** The `Holiday` model exists and holidays are used internally during lesson generation (lessons skip holiday dates). But there's no admin UI — holidays are managed only via the database seed script.

**Change:** Add a `/holidays` page (new sidebar tab) with:
- Table showing all holidays: date, name
- "Add Holiday" form: date picker + name input
- Delete button per holiday
- When adding/deleting a holiday, warn if it affects any existing scheduled lessons (lessons already created on that date). Don't auto-modify lessons — just inform the admin.

---

## 32. Deactivate button "active membership" error

**Current:** `deactivateStudent()` correctly checks for active memberships (`leaveDate IS NULL`) and returns an error: `"Student has active group memberships (GR-1, GR-2). Handle those first."` This is intentional — you shouldn't deactivate a student who's still in a group.

**Analysis:** This is likely triggered because of the bug in item #20 — when admin sends a student to reassignment, the student isn't removed from the group. Then when trying to deactivate, the membership is still active. Fixing item #20 should resolve most occurrences of this error.

**Change:** After fixing item #20, verify this error no longer appears in the expected workflow. If there are legitimate cases where admin wants to deactivate a student with active memberships (e.g. student just stops responding), consider adding a force option that also closes all memberships with leave billing in one action.

---

## 33. Limit students to 1 group + 1 individual

**Current:** `addStudentsToGroup()` checks for duplicate membership in the same group and schedule conflicts, but does NOT limit how many groups of each type a student can join. A student could be in 3 GROUP-type lessons simultaneously (as long as schedules don't conflict).

**Change:** Add validation in `addStudentsToGroup` that checks:
- If the destination group is type `GROUP`: student must have 0 active GROUP-type memberships (or this would be their 1st)
- If the destination group is type `INDIVIDUAL`: student must have 0 active INDIVIDUAL-type memberships (or this would be their 1st)
- At most: 1 GROUP + 1 INDIVIDUAL simultaneously

Return a clear error if violated: `"Student already has an active group lesson (GR-5). Students can have at most one group and one individual lesson."` This applies to all assignment paths (reception, reassignment, lost list, add-student dialog).

---

## 34. Revisit refunds logic & triggers

**Current (after Phase A):** PENDING refunds are now auto-created in 4 places:
1. **Transfer credit overflow** (`helpers/transfer-credit.ts`) — when overpayment credit from source group exceeds all destination billing periods (original, pre-Phase A trigger)
2. **`deactivateStudent`** (`actions/students.ts`) — when auto-closing all memberships via `performLeaveBilling` returns an overpayment
3. **`sendToReassignment`** (`actions/students.ts`) — when closing a specific membership via `performLeaveBilling` returns an overpayment
4. **`sendToLostList`** (`actions/students.ts`) — same as above

Processing: `actions/refunds.ts` can mark PENDING → COMPLETED (with actual amount returned) or convert to credit on another billing period.

**Research still needed:**
- Should admin be able to manually create a refund from the student detail page?
- What's the approval flow? Currently refunds go PENDING → COMPLETED with no intermediate review step
- How should refunds interact with the "Block future payments" change (item #21)?
- Are the 4 auto-creation triggers above sufficient, or are there other cases (e.g. group cancellation, billing adjustment that creates surplus)?

This needs discussion before implementation to define the full refund lifecycle.

---

# Implementation Phases

## Phase A: Bug Fixes & Broken Behavior ✅

All items completed. Key design decisions made during implementation:

- **#6 expanded:** Added `referredByCode` field to student creation form alongside promo code. The two fields are mutually exclusive (entering one disables the other). Server validates cross-field misuse (referral code in promo field → helpful error).
- **#20 redesigned:** `sendToReassignment` and new `sendToLostList` are now **group-level actions** (scoped to a specific membership), not student-level. They close the specific membership + run leave billing. Student status only changes if no other active memberships remain.
- **#32 redesigned:** `deactivateStudent` is now a "nuclear option" that auto-closes ALL active memberships with leave billing and creates pending refunds. The button is demoted to a subtle muted link in student-actions.tsx (rarely used). Group-level removal is handled by Send to Reassignment / Send to Lost List instead.
- **Orphan warning:** Always-visible collapsible section on reassignment page (auto-expanded when orphans exist, collapsed when empty) so admins always know where to look.
- **Refund triggers expanded (#34 partial):** PENDING refunds are now auto-created whenever `performLeaveBilling` returns an overpayment during membership closure (deactivate, reassignment, lost list) — not just during transfers. Full refund lifecycle discussion still needed.

| # | Item | Status |
|---|------|--------|
| 6 | Promo code error + referral field on student creation | ✅ Done |
| 8 | Zod date error messages: "Must be DD.MM.YYYY" | ✅ Done |
| 19 | Language mismatch: hard error → warning for all levels | ✅ Done |
| 20 | Send to Reassignment: group-level action with leave billing | ✅ Done |
| 22 | Group creation: start date min today | ✅ Done |
| 32 | Deactivate: auto-closes all memberships, demoted in UI | ✅ Done |
| — | New: `sendToLostList` group-level action | ✅ Done |
| — | New: `SendToLostDialog` component in group student list | ✅ Done |
| — | Orphan warning: always-visible collapsible section | ✅ Done |

## Phase B: Trial Resolution Overhaul ✅

All items completed. All student actions in the group student list are now unified into dropdown menus (dots icon trigger, "Actions" column header):

- **Non-trial students (`MemberActionsMenu`):** Transfer / Send to Reassignment / Send to Lost list
- **Trial with attendance (`TrialActionsMenu`):** Commit / Send to Lost list / Send to Reassignment
- **Trial no-show (`TrialActionsMenu`):** Send to Lost list / Send to Reassignment / Transfer Trial
- **Transfer Trial** blocks if trial attempts exhausted — admin must use Lost or Reassignment instead.
- New `transferTrialStudent` server action (lightweight, no billing — closes source trial, creates new trial in destination).
- `TransferDialog` gained optional `open`/`onOpenChange` props for controlled usage from dropdown menus.
- Deleted standalone `send-to-lost-dialog.tsx` and `transfer-trial-dialog.tsx` (functionality inlined into dropdown menus).
- Cleaned up `activeTrialStudentIdsWithAttendance` prop (replaced by membership-ID-based `trialMembershipIdsWithAttendance`).

| # | Item | Status |
|---|------|--------|
| 13 | Resolve button only visible after attendance | ✅ Already done |
| 14 | No-show paths: Send to Lost / Reassignment / Transfer Trial | ✅ Done |
| 15 | Rename "Didn't continue" → "Send to Lost list" | ✅ Done |
| — | Unified dropdown menus for all student actions in group detail | ✅ Done |

## Phase C: Payment Controls & Visibility ✅

All items completed (except #34 which remains a research/discussion item).

- **#21 — Payment validation:** Server-side validation in `recordPayment` blocks future-month payments (periodYear/periodMonth > current) and caps amount at remaining balance. Client-side `max` attribute on amount input for immediate feedback.
- **#16 — Remaining amount visibility:** "Remaining" column added to No Payment table (red text). Group detail student list now shows remaining amount in red next to the payment status badge for unpaid students. `discountAmount` added to group query's paymentPeriods select.
- **#17 — Payment History page:** Separate `/payment-history` route (not a tab on `/payments`) with its own sidebar entry. DataTable showing paid payments with: date, CRM, student name, group, billing period, amount, method badge, recorded by. Month picker (last 6 months) + payment method filter pills. Search by name/CRM. Total amount display. Added "Bank Transfer" (`bank_transfer`) as a new payment method across all components (schema, record dialog, payment history, paid payments table). No DB migration needed — `paymentMethod` is a `String` field.

**Code review fixes (applied post-implementation):**
- `updateStudent`: moved `revalidatePath` + `redirect` outside try/catch — `redirect()` throws internally in Next.js, catch block could swallow it
- `sendToReassignment`: membership validation moved before the transaction — returns `{ error }` instead of throwing inside the transaction
- `record-payment-dialog`: added `handleOpenChange` that resets amount/method/note from fresh props on dialog open — fixes stale state when dialog is reused after external data changes
- `payment-history` page: searchParams validated with `Number.isFinite()` + month range check — falls back to current month/year on garbage input
- `reactivateStudent`: clears `isUncertain` and `uncertainComment` on reactivation — previously kept stale uncertain flag

| # | Item | Status |
|---|------|--------|
| 21 | Block future-month payments + cap at amount due | ✅ Done |
| 16 | Show remaining amount on No Payment list & group details | ✅ Done |
| 17 | Payment History page + "Bank Transfer" method | ✅ Done |
| 34 | Revisit refunds logic & triggers | Deferred (needs discussion) |

## Phase D: Small UI Polish ✅

All items completed. Key implementation details:

- **#4 — Phone search:** Reception and students tables now search by name, phone, and parent phone (same pattern as No Payment table — manual `useState` + `.filter()` replacing DataTable's `searchKey`). Search placeholders updated to hint filterable fields.
- **#5 — Comment visibility:** Reception table comment column changed from `text-muted-foreground` to `text-foreground`.
- **#9 — Age column:** Added to reception table, students table, and group detail student list. Shared `getAge()` helper in `src/lib/helpers/date.ts`. Reception query updated to include `dateOfBirth` and `family.parentPhone`.
- **#11 — Schedule navigation:** Teacher names in schedule grid wrapped in `<Link>` to `/teachers/[id]`.
- **#23 — Teacher filter:** Filter pills (Active/Deactivated/All) on teachers page. Wired up existing `getAllTeachers(includeInactive)` query. Deactivated teachers show muted styling + "Deactivated" badge.
- **#30 — Lessons by month:** Group detail page shows monthly breakdown (e.g. "Mar — 5 lessons") instead of just total count. Total shown as summary line below.
- **Bonus — MONTH_NAMES consolidation:** Extracted `MONTH_NAMES` (short) and `MONTH_NAMES_FULL` (long) into `src/lib/constants.ts`, replacing 8 inline definitions across payment and teacher-payment components.

| # | Item | Status |
|---|------|--------|
| 4 | Phone number search filter on reception + students tables | ✅ Done |
| 5 | Comment column font color on reception — `text-muted-foreground` → visible color | ✅ Done |
| 9 | Age column calculated from DOB on all student list views | ✅ Done |
| 11 | Schedule → teacher details navigation — wrap names in `<Link>` | ✅ Done |
| 23 | Active/deactivated teacher filter toggle on teachers page | ✅ Done |
| 27 | Student page → group details navigation — **already done** | ✅ |
| 30 | Lessons count by month breakdown instead of total on group detail | ✅ Done |

## Phase E: Reception Workflow (First/Second Lessons) ✅

All items completed. Reception page now has pill-tabbed views (Reception / First Lessons / Second Lessons):

- **#1 — Add Student button:** Links to `/students/new?returnTo=/reception` — after creation, admin redirects back to reception. Breadcrumb adapts. `redirectTo` whitelisted in server action to prevent open redirect.
- **#2 — First Lessons tab:** Shows all active trial students with attendance status badges (Upcoming/Attended/Absent/No record). Reuses `TrialActionsMenu` for commit/lost/reassignment/transfer actions. Sorted by joinDate ascending (longest-waiting first).
- **#3 — Second Lessons tab:** Shows committed-from-trial students with unpaid current-month billing. Columns: lessons attended, payment status, remaining amount. Red row highlight when 2+ lessons attended but still unpaid (urgent). Sorted by lessons attended descending.

| # | Item | Status |
|---|------|--------|
| 1 | "Add student" button on reception tab with returnTo redirect | ✅ Done |
| 2 | "First lessons" list — trial students with attendance + actions | ✅ Done |
| 3 | "Second lessons" list — committed unpaid + red highlight at 2+ | ✅ Done |

## Phase F: Teacher Management ✅

All items completed.

- **#10 — Availability redesign:** Per-day checkboxes (Mon–Sun) replaced with "Mon, Wed, Fri" / "Tue, Thu, Sat" pattern toggles. Free-form time inputs replaced with TIME_SLOTS `<Select>` dropdowns (same slots used in group scheduling). Both patterns can be active simultaneously, each with multiple time ranges. Display mode shows pattern label + time badges. Unavailability form time inputs also swapped to TIME_SLOTS selects. No schema/action changes — purely UI.
- **#12 — Rate history editing:** Inline edit mode per rate row (pencil icon → editable inputs → save/cancel). Both add and edit enforce min(1) + max(current PriceSetting price) validation. Server-side `validateRateLimits()` queries `getCurrentPriceLimits()` for caps. New `updateRateChange()` action. Price limits shown as helper text ("Max: X UZS").
- **#12 — Delete UNPAID payments:** New `deleteTeacherPaymentPeriod()` action (guards PAID records). Payment history table extracted to client component (`PaymentHistoryTable`) with trash icon + `ConfirmationDialog` on UNPAID rows. Correction flow: edit rate → delete UNPAID record → "Generate Pay" recreates with corrected rate (via `skipDuplicates`).
- **#18 — Teacher file uploads:** `TeacherDocument` model added to schema (`teacherId`, `fileName`, `fileKey`, `fileSize`, `uploadedById`). AWS SDK deps added (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`). `TeacherDocumentsSection` component rendered on teacher detail page.

| # | Item | Status |
|---|------|--------|
| 10 | Availability redesign — pattern toggles + TIME_SLOTS selects (UI-only) | ✅ Done |
| 12 | Rate history editing + validation + delete UNPAID payment records | ✅ Done |
| 18 | Teacher file uploads — model + storage + UI | ✅ Done |

## Phase G: Uncertain Students ✅

| # | Item | Status |
|---|------|--------|
| 24 | Uncertain reason dialog — dropdown (14 reasons + Other) + history tracking | ✅ Done |
| 25 | Uncertain page actions — resolve / reassign / transfer / lost + auto-clear on actions | ✅ Done |

## Phase H: Promotions, Comments & Constraints ✅

All items completed.

- **#7 — Promotion assign:** Dropdown filtered to APOLOGY/REWARD only (query + server-side guard). Required comment textarea with `(required)` hint and `Label` added to assign dialog. `comment String?` field added to `StudentPromotion` model (migration `20260325130032`). Comment column displayed in promotions table on student detail page. Schema validates max 500 chars.
- **#28 — Inline comment editing:** New reusable `EditCommentDialog` component (`components/shared/edit-comment-dialog.tsx`) — clickable comment text opens dialog when present, subtle pencil icon when empty. Wired into 4 locations: student detail page (Comment field in profile grid), reception table, reassignment table, group student list. Two new server actions: `updateStudentComment` (revalidates student detail + reception + reassignment), `updateMembershipComment`.
- **#33 — Group membership limit:** Validation enforced in all 3 entry points: `addStudentsToGroup`, `transferStudent`, `transferTrialStudent`. Students can have at most 1 GROUP + 1 INDIVIDUAL active membership simultaneously. Transfer actions exclude the source group being left from the count.

**Code review fixes applied:**
- `DialogDescription` (sr-only) added to EditCommentDialog and AssignPromotionDialog for Radix accessibility
- `aria-label` on pencil icon trigger
- `updateStudentComment` checks student existence before update
- Duplicate import merged in reassignment-table.tsx

**Student detail page UI polish (done alongside Phase H):**
- Header redesigned: `Name #CRM [Status]` on same line, phone below
- "Notes" section removed — Comment field moved into main profile info grid

| # | Item | Status |
|---|------|--------|
| 7 | Promotion assign: only Apology/Reward + required comment | ✅ Done |
| 28 | Inline comment editing — Student.comment + GroupMembership.comment (4 locations) | ✅ Done |
| 33 | Limit students to 1 group + 1 individual (3 entry points) | ✅ Done |

## Phase I: Exams & Scheduling ✅

All items completed.

- **#29 — Exam auto-creation:** `calculateExamDates()` helper in `helpers/exam-calculation.ts`. Mid exam at lesson `Math.floor(total / 2)`, final at 3rd-from-end. Exams auto-created inside the group creation transaction (both `createGroup` and `graduateGroup`). Groups with < 5 lessons skip exam creation.
- **Group detail display:** Exam dates shown as chips in the info grid (same pattern as monthly lesson breakdown). Pre-existing groups without exams handled gracefully (cell not rendered).
- **Exams page (`/exams`):** New sidebar entry (BookOpen icon). Server component with month filter pills (1 back + 4 forward). DataTable with columns: Group, Type (Mid/Final badge), Date, Level, Teacher, Schedule. Search by group publicId. Only active groups shown.

| # | Item | Status |
|---|------|--------|
| 29 | Exam dates auto-calculated on group creation + Exams page with month filter | ✅ Done |

## Phase J: Scheduled Actions (Effective Date) ✅

### Design decisions (from discussion 2026-03-26)

#### Problem
All actions (transfer, send to lost, send to reassignment, deactivate, merge groups) execute immediately with `new Date()`. Admins need to schedule actions for future dates — e.g. "student says starting next week I won't be attending" or "transfer me to Group B next Monday."

#### Approach: Vercel Cron + `ScheduledAction` model

**Rejected alternatives:**
- **Date override (execute now, use future date for billing):** Creates a limbo state — student appears removed from group but billing runs until the future date. Operationally confusing.
- **Visual reminder + manual execution (Approach D):** Relies on admin clicking a button on the right day. Fragile.
- **Backdate-only (no future dates):** Doesn't solve the core use case — future scheduling is the common need.

**Chosen approach:** A `ScheduledAction` model stores pending actions. A daily Vercel Cron job executes actions whose `effectiveDate <= today`. This infrastructure will also be reused for the planned amoCRM polling (5-10 min intervals).

#### Conflict resolution: Block at creation time (Strategy C)

All conflicts are resolved by **blocking** — no auto-cancel, no re-targeting, no magic. Admin always resolves conflicts explicitly.

| Situation | Rule |
|---|---|
| Immediate student action (transfer/reassign/lost) + pending scheduled action on **same membership** | **Block** immediate action. Admin must resolve (cancel or execute) the scheduled action first. |
| Immediate deactivate + **any** pending scheduled action for that student | **Block**. Admin must resolve all scheduled actions first. |
| Creating a scheduled action + another already exists on **same membership** | **Block**. One scheduled action per membership at a time. |
| Scheduled merge + another scheduled merge on **same group** | **Block**. One at a time. |
| Immediate merge + student scheduled actions with **earlier** effective dates | **No conflict.** Student actions execute first in natural chronological order. |
| Immediate merge + student scheduled actions with **later** effective dates | **Block** merge. Admin must resolve student-level actions first (cancel, execute early, or reschedule the merge to after them). |

**Rationale for merge blocking:** If a group is merging on March 10 but Student A has a scheduled transfer on March 15, the admin must decide: does Student A transfer now (execute early), stay and get merged (cancel the scheduled action, re-create later for the new group), or does the merge wait? This is a human decision — the system shouldn't guess.

#### Data model

```
ScheduledAction {
  id            String   @id @default(cuid())
  type          ScheduledActionType  // TRANSFER, SEND_TO_REASSIGNMENT, SEND_TO_LOST, DEACTIVATE, MERGE_GROUP
  status        ScheduledActionStatus // PENDING, COMPLETED, FAILED, CANCELLED
  effectiveDate DateTime @db.Date

  // Student-level actions (transfer/reassign/lost/deactivate)
  studentId     String?  → Student
  membershipId  String?  → GroupMembership  // which membership the action targets

  // Merge actions
  sourceGroupId String?  → Group
  destGroupId   String?  → Group

  // Action-specific parameters
  payload       Json     // { destinationGroupId, lostReasonId, transferReasonId, etc. }

  // Audit
  createdById   String   → Admin
  createdAt     DateTime @default(now())
  executedAt    DateTime?
  cancelledAt   DateTime?
  cancelReason  String?
  failureReason String?
}
```

#### Timezone handling

All date comparisons use Tashkent time (`Asia/Tashkent`), not UTC. This prevents a mismatch where an admin working late (e.g. 1 AM Tashkent = 20:00 UTC previous day) picks "today" but the server interprets it as tomorrow.

Shared helper for deriving "today" in Tashkent:
```ts
function getUzbekistanToday(): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' });
  const todayStr = formatter.format(new Date()); // "YYYY-MM-DD" in Tashkent
  return new Date(todayStr + 'T00:00:00Z');
}
```

Used in two places:
1. **Immediate vs. scheduled decision** — if `effectiveDate === uzbekistanToday`, execute immediately; if future, create scheduled action.
2. **Cron handler** — `WHERE effectiveDate <= uzbekistanToday` query.

#### Execution flow

1. **Admin picks an effective date** (required field, no default) on transfer/lost/reassignment/deactivate/merge dialogs.
2. **If effective date = today (Tashkent):** action executes immediately (same as current behavior). No `ScheduledAction` record created.
3. **If effective date > today (Tashkent):** `ScheduledAction` record created with `status: PENDING`. Conflict check blocks if conflicts exist (see table above).
4. **Daily cron** (`/api/cron/execute-scheduled-actions`, runs at 00:00 UTC = 05:00 Tashkent via `vercel.json`):
   - Query all `PENDING` actions where `effectiveDate <= uzbekistanToday`
   - For each: validate preconditions (membership still active, group still exists, etc.) using the same validation the immediate actions already have
   - Execute by calling extracted core logic helpers (same business logic as immediate actions)
   - Mark `COMPLETED` or `FAILED` with reason
   - Each action try/caught independently — one failure doesn't block others
   - Race condition safety: re-check `status: PENDING` in the atomic update
5. **Admin can cancel** a pending action at any time from the Scheduled Actions list.
6. **Admin can execute early** — "Execute Now" button on pending actions for when plans change.

#### Refactoring approach

Existing server actions (`transferStudent`, `sendToLostList`, etc.) combine auth + business logic + cache invalidation. The cron handler can't call them directly (no session, no client to revalidate). **Solution:** extract core transaction logic from each action into a shared helper that accepts `adminId` + optional `effectiveDate`. Both the server action and the cron call the same helper.

#### UI additions

- **Required date picker** on transfer/lost/reassignment/deactivate/merge dialogs — "Effective date" field, `<input type="date">`, no default value, `min={today}`. Admin must explicitly choose when the action takes effect.
- **Scheduled Actions page** (`/scheduled-actions`) — sidebar entry with pending count badge. DataTable: type, student/group, source, destination, effective date, status badge, created by, failure reason. Status filter tabs. Cancel + Execute Now buttons on PENDING rows.
- **Blocking warnings** — when an immediate action is blocked by a scheduled action, show: *"This student has a scheduled transfer to GR-12 on April 1. Cancel or execute it first."*
- **Billing preview hidden for future dates** — transfer/merge preview sections show "Billing will be calculated on the effective date" when a future date is selected.

#### Implementation breakdown

| # | Item | Size | Status |
|---|------|------|--------|
| 26a | `ScheduledAction` model + migration + reverse relations | Small | Done |
| 26b | Tashkent timezone helper (`getUzbekistanToday`) | Small | Done |
| 26c | Extract core logic from 5 actions into shared helpers (`execute-*.ts`) — existing actions become thin wrappers | Medium-Large | Done |
| 26d | Conflict detection helper (`scheduled-action-conflicts.ts`) — 4 check functions + message formatter | Small-Medium | Done |
| 26e | Add conflict checks to all 5 existing immediate actions | Small | Done |
| 26f | Scheduled action CRUD server actions (`createScheduledAction`, `cancelScheduledAction`, `executeScheduledActionNow`) + Zod schemas | Medium | Done |
| 26g | Vercel Cron setup (`vercel.json` + CRON_SECRET) + cron route handler | Small-Medium | Done |
| 26h | Required date picker on transfer/lost/reassignment/deactivate/merge dialogs — today = immediate, future = scheduled | Medium | Done |
| 26i | Scheduled Actions list page + sidebar entry with badge | Medium | Done |

## Phase K: Holidays Management

### How holidays work today

The `Holiday` model is a simple table (`date` unique, `name` text) seeded with Uzbekistan 2026 public holidays. Holidays are **consumed at lesson-generation time only** — they have no retroactive effect on existing data.

**Where holidays are checked:**]
1. **Group creation** — `generateLessonDates()` in `lesson-generation.ts` skips any date in the `holidayDates` set when pre-creating Lesson + TeacherScheduleSlot records from `startDate` through `endDate`.
2. **End date calculation** — `calculateEndDate()` in the same file accounts for skipped holidays, so the group extends further to reach the target lesson count.
3. **Cancellation replacement** — `findNextValidDate()` in `lesson-scheduling.ts` finds the next day matching the group's day pattern that is NOT a holiday. Used when appending a replacement lesson after a cancellation.
4. **Graduation** — new next-level group's `startDate` is computed via `findNextValidDate()`, so it skips holidays.
5. **Billing** — `BillingPeriod.totalLessons` reflects the actual count of pre-created lessons per month (holidays reduce the count → lower `amountDue`).

**No admin UI exists.** Holidays are managed only via the database seed script.

### What's needed (feedback item #31)

Add a `/holidays` page (new sidebar tab) with:
- Table showing all holidays: date, name
- "Add Holiday" form: date picker + name input
- Delete button per holiday
- When adding/deleting a holiday, **warn** if it affects existing scheduled lessons on that date. Don't auto-modify lessons — just inform the admin.

### What's undecided

Adding or deleting a holiday **after groups already exist** has no automatic effect — lessons already generated are untouched. This raises several open questions:

1. **Adding a holiday on a date with existing lessons:** The documented plan says "warn only." Admin would need to manually cancel each affected lesson (which triggers the normal cancel flow — replacement appended after endDate, billing adjusts). Should there be a **bulk-cancel** option for all lessons on that date? Or a one-click "cancel all lessons on this holiday" action?

2. **Deleting a holiday:** If a holiday is removed and groups were created while it existed, those groups have a "gap" (no lesson on that date). Should the admin be informed? Should they be able to insert lessons on the freed date? Or is it purely informational?

3. **Holiday scope:** Are holidays always global (all groups skip the date), or could there be teacher-specific or group-specific days off? Current model assumes global.

4. **Year rollover:** Holidays are seeded for 2026 only. When 2027 starts, who adds the new holidays? The admin via the CRUD page, or do we seed annually? Some Uzbek holidays (Eid al-Fitr, Eid al-Adha) shift yearly — they can't be auto-calculated.

| # | Item | Size |
|---|------|------|
| 31 | Holidays CRUD page — table, add, delete, with affected-lesson warnings | Small |
| — | Decide on bulk-cancel flow when adding a holiday that collides with existing lessons | Design |
| — | Decide on delete-holiday behavior (inform only vs. allow filling gaps) | Design |

---

## Phase L: Test Suite Revisit

After completing the phases above, revisit the integration test suite (`apps/admin/src/__tests__/scenarios/`):
- Add new tests for changed behavior (e.g., trial transfer, payment caps, effective dates)
- Update existing tests broken by Phase A bug fixes or Phase B trial resolution changes
- Add coverage for new features (First/Second lessons lists, uncertain student flow, exam dates)
- Verify BUG-001 fix still holds after any billing/refund changes (Phase C #34)