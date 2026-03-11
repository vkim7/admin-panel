# Admin Panel (Next.js Web App)

Admin's primary tool for managing day-to-day operations. Co-founder (experienced in scaling English schools) is the primary user.

---

## Scheduling Constraints

All lessons follow fixed constraints that keep operations manageable at scale:

- **Day patterns:** 1,3,5 (Mon/Wed/Fri) or 2,4,6 (Tue/Thu/Sat)
- **Fixed time slots:** 14:00 / 15:30 / 17:00 / 18:30 / 20:00
- **Lesson duration:** 80 minutes (group and individual)
- **New groups ideally start on the 1st of the month.** Groups starting later must catch up — the missed lessons' workload is spread evenly across the remaining program timeline (e.g. group starts on the 15th → 15 days behind, curriculum compressed to catch up with other groups at the same level)
- Groups can be merged if necessary (e.g. two small groups at the same level)

---

## Main Schedule (primary view)

The page admin spends the most time on — the operational pulse of the school.

Two grids: one for 1,3,5 (MWF) and one for 2,4,6 (TTS). Rows = teachers, columns = time slots.

Each cell shows:
- **GR** (group) or **IND** (individual)
- Group/student public ID (e.g. GR-1, GR-2)
- Level (Beginner, Elementary, Pre-intermediate, Intermediate, Upper-intermediate, Advanced — matching Navigate textbooks)
- Progress stage (beginning / mid / final — which third of the program the group is in)
- Paid count / total (e.g. "3/5" = 3 out of 5 students have paid)

**Example: 1,3,5 grid**

|  | 14:00 | 15:30 | 17:00 | 18:30 | 20:00 |
|---|---|---|---|---|---|
| Teacher A | GR-1 Beginner beg 5/5 | | GR-3 Pre-int mid 4/6 | | IND-1 Intermediate |
| Teacher B | | GR-2 Beginner fin 3/5 | | GR-4 Elementary beg 6/6 | |

**What admin can do from this view:**
- See at a glance: which teachers are busy, which slots are open, which groups have seats available, which groups have unpaid students
- Click a cell to open group/student details
- Identify where to place new students from reception

---

## Group Details (per-group view)

Opened by clicking a group cell on Main Schedule.

### Student Table

| # | CRM Code | Date of Start | Name | Surname | Phone | Uncertain | Lessons Start | Lessons Paid | Active | Comment |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 100010001 | 01.01.2025 | Luiza | Lee | 998974554545 | No | | 12 | Yes | Wants to transfer next month |
| 2 | 100010002 | 01.01.2025 | John | Doe | 998974554546 | Yes | 5 | 10 | Yes | |

**Fields explained:**
- **CRM Code:** unique student identifier across the system
- **Uncertain:** subjective flag set by teacher or admin — gut feeling that student is at high risk of leaving. Surfaces the student on the Uncertain List
- **Lessons Start:** which lesson number the student joined at (e.g. joined on lesson 5 of the program). Used for prorated billing calculation
- **Lessons Paid:** number of lessons paid for. Usually 12 (monthly). Can be less for partial payments (some parents can't afford full payment upfront)
- **Active:** studying or left. If left, reason should be noted in comment (future: move to Lost List with structured reason)

### Billing Model
- **First month (new student):** prorated — remaining lessons this month × per-lesson price
- **All future months:** actual lesson count for that month × per-lesson price (typically ~12 lessons, varies by month due to holidays and calendar)
- **Teacher payout:** students × hours taught × per-lesson teacher rate (per student-hour model — incentivizes teachers to keep groups full and retain students)

### Transfer (later scope)
- Transfer button to move student to a different group
- Records transfer history (which group, how many lessons taken)

---

## Reception (student pipeline)

Filtered view of students with status **"awaiting_assignment"**. Same student entity as Student Management — not a separate record.

### Data Source: amoCRM (Kommo) Integration

Lead management (initial contact, follow-up calls, ghosting, placement test scheduling) happens in **amoCRM**. Once a student passes the placement test, amoCRM pushes them into our system:

```
amoCRM: lead → contacted → placement test booked → placement test passed
        ↓ (API integration — polling or webhook)
Our DB: student created (status: awaiting_assignment)
        → visible in: Reception + Student Management
```

**Integration approach:**
- **Launch:** API polling every 5-10 min — fetch leads in amoCRM's "Ready for Group" pipeline stage, create student records in our DB
- **Later:** webhooks for real-time sync (requires amoCRM Advanced plan), and/or in-app placement test in Telegram Mini App (students enter our system earlier, amoCRM becomes optional for lead capture)

**Data model note:** student records can exist before group assignment. Design status field to support the full lifecycle from the start: `awaiting_assignment → active → inactive`

### Reception Table

| # | CRM Code | Name | Surname | Phone | Level | Date of Start | Transfer | Comment | Timetable | Timeslot |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 100010001 | Luiza | Lee | 998... | Beginner | 01.01.2025 | | | 1,3,5 | 14:00 |
| 2 | 100010002 | John | Doe | 998... | Beginner | 01.01.2025 | | | | |

**Fields explained:**
- **Timetable:** student's preferred day pattern (1,3,5 or 2,4,6)
- **Timeslot:** preferred time from fixed slots (14:00 / 15:30 / 17:00 / 18:30 / 20:00)
- **Transfer button:** when admin finds a suitable group, clicking Transfer opens a group selection popup to assign the student. Student status changes to "active", disappears from Reception.

**Workflow:** amoCRM pipeline → placement test passed → student record created in our DB (status: awaiting_assignment) → appears in Reception → admin assigns to group → status becomes "active" → student notified via Telegram

---

## No Payment List (daily ops tool)

List of students who haven't paid. Used every day to check who needs reminding/calling/warning.

Shows prominent **unpaid count** at the top (e.g. "35 unpaid").

| CRM Code | Name | Surname | Level | Group | Payment Amount | Phone |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... |

**Features:**
- SMS reminder to single or multiple selected students/parents (multi-select)
- Once paid: admin enters amount, student removed from list
- Typical usage: all students appear here on the 1st of the month, list shrinks as payments come in. Newly registered mid-month students also appear here.

**Notification channels:** SMS for payment reminders (co-founder preference — higher urgency/open rate). Telegram for all other notifications (lesson reminders, homework). Build both channels so routing is configurable.

---

## Student Management

All students regardless of status — the complete view. Same entities shown in Reception, Group Details, No Payment List — just different filters.

- Search/filter by: name, CRM code, level, group, teacher, payment status, status (awaiting_assignment / active / inactive)
- Student profile view: CRM code, personal info, level, current group, teacher, full lesson history, homework history, payment history, comments
- Edit student: update level, phone, personal info
- Move student between groups
- Mark payment status (paid / unpaid)
- Deactivate student (with reason — feeds into future Lost List)

---

## Teacher Management

- Add/edit teacher profiles (name, phone, levels they can teach, language capabilities)
- Set teacher availability (which day patterns and time slots they work)
- Assign groups and individual students to teachers
- View teacher load: filled slots / available slots, total students, groups count

---

## Later Scope

### Admin Panel Tabs
- Uncertain List — students flagged as high churn risk by teacher or admin
- Exam List — teacher-set mid/final exam dates per group (teacher manually adds based on curriculum progress)
- Lost List — students who left, with reason and phone for reactivation
- Payment List — financial reporting, filter by year/month/teacher/group, teacher salary calculations

### Other
- Content Management (teachers manage materials themselves for now — physical textbooks + own presentations)
- Analytics (student counts, revenue, utilization, homework completion)
- Payment integration (Click, Payme)
- Teacher recruitment pipeline
- Automated re-engagement comms
- Bulk student actions
