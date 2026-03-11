# Admin Panel Draft

> **Original operational draft from the co-founder** with real spreadsheet examples showing day-to-day usage patterns. Refined spec is in `admin-panel-plan.md`. Data model details are in `packages/database/DATA_MODEL.md`.

# Main Schedule

"Main schedule" tab \- used by admin staff to monitor teachers' schedule. To see what groups have available seats, what time slots are available for teachers to work at, etc. This is the page admin staff spends a lot of time on \- checking pulse of the operations

1,3,5 (table for Mon, Wed, Fri)

|  | 14:00 (fixed time slots: 14:00, 15:30, 17:00, 18:30, 20:00) \- duration is 80 mins by default, can be 60 | 15:30 | 17:00 | 18:30 | 20:00 |
| :---- | ----- | ----- | ----- | ----- | ----- |
| Teacher's name | GR or IND (group or individual lessons) \- 1 (public ID) \- Beginner (level) \- beginning/mid/final (progress stage) \- 3/5 (paid/total students) |  |  |  |  |
| Vladimir Kim |  | GR-2 Beginner fin 3/5 |  |  |  |
| Vakilov Aziz |  |  | GR-3 Pre-intermediate 3/5 |  |  |

---

2,4,6 (table for Tue, Thu, Sat)

|  | 14:00 | 15:30 | 17:00 | 18:30 | 20:00 |
| :---- | ----- | ----- | ----- | ----- | ----- |
| Лазиз Исламходжаев |  | GR-5 Pre-intermediate 3/5 |  |  |  |
| Ким Вова | GR-4 Intermediate 5/5 |  |  |  |  |
| Азиз Вакилов |  |  |  |  |  |

# Group details

- When student has just joined our classes amount he's charged is calculated based on the number of remaining lessons this month \* price of one lesson (prorated first month, tracked via `StudentPaymentPeriod.isProrated`).
- For all the other future payments he's charged based on the 12 lessons calculation (we assume average and make the payment amounts fixed)
- one of the reasons we are tracking at what lesson student has joined is pay out calculation to teacher. Teachers are paid based on the hours taught to students. E.g. 5 students each studied 12 hours a month \- payout for the month is 5 \* 12 \* teacher's per-student group rate (`Teacher.groupLessonRate`)
- we keep the **Lessons paid** mostly for edge cases \- some parents can't afford a full payment so they ask for partial payments (tracked via `StudentPaymentPeriod.lessonsPaid`)

| \# | CRM Code | Date of start | Name | Surname | Telephone | Uncertain | Lessons start | Lessons paid | Active | Comment |
| ----- | ----- | ----- | :---- | :---- | ----- | :---- | ----- | ----- | :---- | :---- |
| 1 | 100010001 | 01.01.2025 | Luiza | Lee | 998974554545 | No |  | 12 | Yes | Want to transfer to another group next month |
| 2 | 100010002 | 01.01.2025 | John | Dou | 998974554546 | Yes | 2 | 10 | Yes |  |
| 3 | 100010003 | 01.01.2025 | Troo | Bee | 998974554547 | No |  | 12 | Yes |  |
|  |  |  |  |  |  |  |  |  |  |  |
| 1 | 100010004 | 01.01.2025 | Arron | Brown | 998974554548 | No |  | 8 | No (transferred to GR-3, took 8 lessons. Tracked via `GroupMembership`: `leaveDate`, `transferReasonId`, `lessonsCompleted`) |  |
|  |  |  |  |  |  |  |  |  | No (left school. Tracked via `Student.status = INACTIVE`, `Student.lostReasonId`, `Student.inactivatedAt`. Appears on Lost List) |  |

**Data model notes:**
- **Uncertain** — subjective flag set by teacher or admin (`Student.isUncertain`, `Student.uncertainFlaggedBy`). Surfaces the student on the Uncertain List.
- **Active** — `Student.status` lifecycle: `AWAITING_ASSIGNMENT → ACTIVE → INACTIVE`. Reason for leaving stored in `Student.lostReasonId` (references `LostReason` table).
- **Transfer** — tracked via `GroupMembership.transferReasonId` (references `TransferReason` table) + `GroupMembership.lessonsCompleted`. Full history preserved — old membership gets `leaveDate`, new membership created in target group.
- **Comment** — two levels: `Student.comment` (global, shown in student profile) and `GroupMembership.comment` (per-group, shown in group details).

# Reception

"Reception" tab \- a list of students who have completed the placement test and are awaiting assignment (`Student.status = AWAITING_ASSIGNMENT`).

| \# | CRM code | Name | Surname | Telephone | Level | Date of start | Transfer | Comment | Call history | Timetable | Timeslot |
| ----- | ----- | :---- | :---- | ----- | :---- | ----- | ----- | :---- | :---- | :---- | :---- |
| 1 | 100010001 | Luiza | Lee | 998974554545 | Beginner | 01.01.2025 |  |  |  | 1,3,5(Mon,Wed, Fri) | 14:00 |
| 2 | 100010002 | John | Doe | 998974554546 | Beginner | 01.01.2025 |  |   | Call history tracked via `CallHistory` model (calledAt, note, calledById). Original spreadsheet used "R- date" to mark recalled students \- admin makes up to 3 reminder calls for students who are ghosting. |  |  |
| 3 | 100010003 | Troo | Bee | 998974554547 | Beginner | 01.01.2025 | "Transfer" button \- when admin finds a suitable group, clicking Transfer opens a group selection popup. Student status changes to ACTIVE, disappears from Reception. |  |  |  |  |

# No payment list

"No payment list" \- list of students that haven't paid for the lessons. Usually all students on the first day of the month or newly registered students e.g. joined in the middle of the month. Once paid, amount paid is entered and student is removed from the list.

Queried from `StudentPaymentPeriod` where `paymentStatus != PAID` for the current month. Search matches by both `Student.phone` and `Family.parentPhone` to quickly find records when a parent sends a payment receipt via Telegram.

One of the features needed here will be SMS reminders sent out to parents. Single or multiple phone numbers at the same time (multi-selection needed). Tracked via `SmsHistory`.

This list is used everyday to check who needs to be reminded / called / warned.

35 unpaid

| CRM code | Name | Surname | Level | Group | Payment Amount | Telephone |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

# Uncertain list

| CRM code | Name | Surname | Level | Group | Who made uncertain | Telephone | Total Absent | Comment | Done |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  | Teacher/Admin (`Student.uncertainFlaggedBy`) |  | 2 (computed from `Attendance` records) |  | Yes/No (TBD \- needs further clarification) |
|  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |

# Exam list

| Teacher | Group | Level | Type | Date | Comment |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  | Mid/Fin (`ExamType` enum) | Каждые 15 уроков |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

Teacher column derived via `Exam → Group → Teacher` join.

# Lost list

| CRM code | Name | Surname | Teacher | Date | Why left | Telephone |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  | (derived from last active `GroupMembership → Group → Teacher`) | `Student.inactivatedAt` | `Student.lostReasonId` → `LostReason` table |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

# Payment list

Filter by: year, month, teacher, group\#, total amount

| Year | Month | Teacher | Group \# | Total amount | Salary |  |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

TOTAL AMOUNT for returned results

Teacher salary computed as: `lessons delivered × active students in group × Teacher.groupLessonRate` for groups; `lessons delivered × Teacher.individualLessonRate` for individual lessons.

# Teacher app: Group details

Teacher's view of the group details page.
Teacher would be responsible for managing attendance.
2-4-6-8-10-12-14-16-18-20 \- dates of the lessons (columns are `Lesson.lessonDate`, rows are students, cells are `Attendance.isAbsent`)

| \# | CRM Code | Name | Surname | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | Total Absent | Uncertain | Lessons paid | Comment | Mid Exam date | Fin Exam date |
| ----- | ----- | :---- | :---- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | :---- | ----- | :---- | :---- | :---- |
| 1 | 100010001 | Luiza | Lee | 1 |  |  |  | 1 |  |  |  |  | 1 | 3 | No | 12 |  |  |  |
| 2 | 100010002 | John | Dou |  | 1 | 1 |  |  |  | 1 |  | 1 |  | 4 | No | 12 |  |  |  |
| 3 | 100010003 | Troo | Bee |  |  |  |  |  |  | 1 |  |  |  | 1 | Yes | 10 |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 | 100010004 | Arron | Brown |  |  |  | 1 |  | 1 |  |  |  | 1 |  | Yes | 8 |  |  |  |
