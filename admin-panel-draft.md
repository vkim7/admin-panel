# Main Schedule

“Main schedule” tab \- used by admin stuff to monitor teachers’ schedule. To see what group have available seats, what time slots are available for teachers to work at, etc. This is the page admin stuff spends a lot of time on \- checking pulse of the operations

1,3,5 (table for Mon, Wed, Fri)

|  | 14:00 (fixed time slots \- all classes start at one of these time slots: 1400, 1530, 1700, 1830, 2000\) \- duration could differ \- for now we’re thinking 80 mins could differ for individual lessons | 15:30 | 17:00 | 18:30 | 20:00 |
| :---- | ----- | ----- | ----- | ----- | ----- |
| Teacher’s name | [\- GR or IND](https://docs.google.com/spreadsheets/d/1dKL0IXVd_4u6Rql0qntiJliQ-vauC0lpfG3DdzhEL4s/edit?gid=0#gid=0)(group or individual lessons) \- 1(public ID) \- Beginner (difficulty level) \- beginning or mid or final(Progress needed for more precise placement \- each level is divided into “sublevels” based on the progress, e.g. first quarter of the level, second, etc) \- 5 (number of students paid) |  |  |  |  |
| Vladimir Kim |  | GE \- 2 Beginner fin \- 3(unpaid count) |  |  |  |
| Vakilov Aziz |  |  | GE-3 Pre intermediate 3 |  |  |

---

2,4,6 (table for Tue, Thu, Sat)

|  | 14:00 | 15:30 | 17:00 | 18:30 | 20:00 |
| :---- | ----- | ----- | ----- | ----- | ----- |
| Лазиз Исламходжаев |  | GE-5 Pre intermediate 3 |  |  |  |
| Ким Вова | GE-4 Intermediate  5 |  |  |  |  |
| Азиз Вакилов |  |  |  |  |  |

# Group details

- When student has just joined our classes amount he’s charged is calculated based on the number of remaining lessons this month \* price of one lesson.  
- For all the other future payments he’s charged based on the 12 lessons calculation (we assume average and make the payment amounts fixed)  
- one of the reasons we are tracking at what lesson student has joined is pay out calculation to teacher. Teachers are paid based on the hours taught to students. E.g. 5 students each studied 12 hours a month \- payout for the month is 5 \* 12 \* “amount paid to teacher per lesson” or some thing like that  
- we keep the **Lessons paid** mostly for edge cases \- some parents can’t afford a full payment so they ask for partial payments

IGNORE FOR NOW: Active / Transfer

| \# | CRM Code | Date of start | Name | Surname | Telephone | Uncertain (totally subjective judgement of the teacher/admin \- based on the gut feeling “uncertain” means student is high risk of leaving the school) | Lessons start (student has joined the group on the 5th lesson) | Lessons paid | Active (studying or left for some reason \- possible that we would need to store different reasons for leaving) | Transfer | Comment |
| ----- | ----- | ----- | :---- | :---- | ----- | :---- | ----- | ----- | :---- | ----- | :---- |
| 1 | 100010001 | 01.01.2025 | Luiza | Lee | 998974554545 | No |  | 12 | Yes | FALSE | Want to transfer to another group next month |
| 2 | 100010002 | 01.01.2025 | John | Dou | 998974554546 | Yes | 2 | 10 | Yes | FALSE |  |
| 3 | 100010003 | 01.01.2025 | Troo | Bee | 998974554547 | No |  | 12 | Yes | FALSE |  |
|  |  |  |  |  |  |  |  |  |  |  |  |
| 1 | 100010004 | 01.01.2025 | Arron | Brown | 998974554548 | No |  | 8 | No | TRUE | IGNORE FOR NOW: Transfered to GE 3(took X number of lessons) |
|  |  |  |  |  |  |  |  |  |  |  | IGNORE FOR NOW: left \-\> move to the lost list |

# Reception

“Reception” tab \- a list of students who have completed the placement test and are awaiting to be assigned to a group.

| \# | CRM code | Name | Surname | Telephone | Level | Date of start | Transfer | Comment | Call history | Timetable | Timeslot |
| ----- | ----- | :---- | :---- | ----- | :---- | ----- | ----- | :---- | :---- | :---- | :---- |
| 1 | 100010001 | Luiza | Lee | 998974554545 | Beginner | 01.01.2025 |  |  |  | 1,3,5(Mon,Wed, Fri) | 14:00 |
| 2 | 100010002 | John | Doe | 998974554546 | Beginner | 01.01.2025 |  |   | R- date (R was used to mark someone that the admin has called back “recalled”, if for example students expressed interest in studying with us but then is ghosting us \- admin will make up to 3 reminder calls \- that’s what the marking with R and a date is for) |  |  |
| 3 | 100010003 | Troo | Bee | 998974554547 | Beginner | 01.01.2025 | “Transfer” button (when admin finds a suitable group for a student he transfers the student using this button that triggers group selection pop-up |  |  |  |  |

# No payment list

“No payment list” \- list of students that haven’t paid for the lessons. usually all students on the first day of the month or newly registered students e.g. joined in the middle of the month. Once paid amount paid is entered and student is removed from the list.

one of the features needed here will be sms reminders send out to parents. single or multiple phone numbers at the same time(multi-selection needed)

this list is used everyday to check who needs to be reminded / called / warned

35 unpaid

| CRM code | Name | Surname | Level | Group | Payment Amount | Telephone |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

# Uncertain list

| CRM code | Name | Surname | Level | Group | Who made uncertain | Telephone | Total Absent | Comment | Done |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  | Teacher/Admin |  | 2 |  | Yes/No |
|  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |

# Exam list

| Teacher | Group | Level | Type | Date | Comment |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  | Mid/Fin | Каждые 15 уроков |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

# Lost list

| CRM code | Name | Surname | Teacher | Date | Why left | Telephone |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |  |
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

# Teacher app: Group details

Teacher’s view of the group details page.  
Teacher would be responsible for managing attendance.  
2-4-6-8-10-12-14-16-18-20 \- dates of the lessons

| \# | CRM Code | Name | Surname | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | Total Absent | Uncertain | Lessons paid | Comment | Mid Exam date | Fin Exam date |
| ----- | ----- | :---- | :---- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | :---- | ----- | :---- | :---- | :---- |
| 1 | 100010001 | Luiza | Lee | 1 |  |  |  | 1 |  |  |  |  | 1 | 3 | No | 12 |  |  |  |
| 2 | 100010002 | John | Dou |  | 1 | 1 |  |  |  | 1 |  | 1 |  | 4 | No | 12 |  |  |  |
| 3 | 100010003 | Troo | Bee |  |  |  |  |  |  | 1 |  |  |  | 1 | Yes | 10 |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 | 100010004 | Arron | Brown |  |  |  | 1 |  | 1 |  |  |  | 1 |  | Yes | 8 |  |  |  |

