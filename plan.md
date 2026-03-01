# Online English Courses Platform — Product Plan

## Business Context

Online English education platform targeting Uzbekistan market. Starting with beginner through IELTS preparation courses. 1-on-1 and group lessons (up to 6 students) delivered via Zoom. Lessons guided by proprietary teaching materials (currently in physical form, to be digitized). Architected to scale to 1000+ students. Potential regional expansion to Central Asia later.

## Key Market Decisions

- **IT Park registration** — zero corporate tax, VAT, property tax until 2040
- **Telegram-first distribution** — 88% adoption in Uzbekistan, student app is a Telegram Mini App
- **Bilingual teachers** — Uzbek/Russian for beginner levels, English-only for advanced
- **IELTS prep as primary goal** — highest intent, highest willingness to pay, clear ROI for students
- **Pricing**: monthly payments, handled outside the app via e-wallet, admin manually updates payment status

## Platform Overview

Three surfaces + a Telegram bot:

| Surface | Tech | Users |
|---------|------|-------|
| Student app | Telegram Mini App | Students |
| Teacher app | Next.js web app | Teachers |
| Admin panel | Next.js web app | Admin/operations team |
| Telegram bot | Bot API | Students (notifications) |

Lessons happen on **Zoom (paid)**. No in-app video for now. Zoom recordings enabled — shared via link for students who missed a lesson or want to review.

---

## Student App (Telegram Mini App)

### Onboarding
- Application form: name, phone, goal (general English / IELTS prep / business / kids), self-assessed level, preferred days + time slots
- Application goes to admin queue for manual review and teacher/group assignment
- Student notified via Telegram when assigned

### Homework
- View assigned exercises for each lesson
- Exercise types: fill-in-blank, multiple choice, matching, short writing, audio listen + answer
- Auto-graded where possible (multiple choice, fill-in-blank, matching)
- Teacher reviews writing and speaking submissions
- Exercises are fixed per level for now; data model supports per-student customization for later

### Progress
- Current level (A1–C1)
- Lessons attended count
- Homework completion rate

### Vocabulary
- Words from lessons saved to personal list (Uzbek and Russian translations)
- Spaced repetition flashcard review

### Other
- Zoom link for next lesson (individual or group)
- Lesson recording link (when available) — for catching up on missed lessons or review
- Link to teacher's Telegram DM (no in-app chat)

### Out of Scope (Later)
- Schedule view (students remember their fixed schedule)
- Payment inside app
- Referral system
- Shareable progress summaries
- Voice recording exercises

---

## Teacher App (Next.js Web App)

### Schedule
- Weekly calendar showing all assigned individual students and groups
- Each lesson entry shows: student/group name, level, time, Zoom link

### Lesson Delivery
- Pre-loaded lesson guide per session (digitized from physical materials)
- Presentation content to screen-share on Zoom
- Inline teacher tips ("ask this follow-up", "common mistake here")
- Lesson notes field — teacher writes what was covered, what to revisit next time
- Lesson recording: Zoom auto-records, teacher confirms/uploads recording link after lesson

### Homework
- Assign homework per student or per group (fixed set per level for now)
- View submission status per student
- Review and grade writing/speaking submissions
- Add comments/corrections

### Students
- List of all assigned students (individual + within groups)
- Per-student view: level, progress, homework history, lesson history, teacher notes

### Earnings
- Lessons completed this period
- Pay rate
- Expected payout amount

### Out of Scope (Later)
- Vacation management with auto-notification
- In-app chat with students
- Bonus/retention tracking
- Professional development modules

---

## Admin Panel (Next.js Web App)

### Student Management
- View all students with search/filter (by level, group, teacher, payment status, active/inactive)
- Add new student (from application queue or manually)
- Assign student to teacher (individual) or group
- Move student between groups
- Set/update student level
- Mark payment status (paid / unpaid / expiry date)
- View student history (lessons, homework, payments)

### Teacher Management
- Add/edit teacher profiles
- Assign students and groups to teachers
- Set teacher schedule (what days/times they teach, which student/group in each slot)
- View teacher load (number of students, lessons per week)

### Group Management
- Create group: name, level, max 6 students, assigned teacher, recurring schedule (e.g. Mon/Wed/Fri 14:00)
- Add/remove students from group
- View group roster and attendance

### Content Management
- Upload and organize digitized lesson plans by level and course type
- Upload exercises organized by level and topic
- Organize presentation materials (what teacher screen-shares)
- Structure: Course → Level → Unit → Lesson → Exercises
- Designed so a full CMS builder (drag-drop exercise creation, versioning, publish/unpublish) can replace this later without restructuring data

### Analytics (Basic)
- Total students (active / inactive / churned)
- Revenue per month (manual tracking based on payment status)
- Teacher utilization (lessons per teacher)
- Homework completion rates
- New applications pending

### Out of Scope (Later)
- Payment integration (Click, Payme)
- Teacher recruitment pipeline
- Automated re-engagement comms
- Content analytics (exercise error rates, lesson effectiveness)
- Full financial reporting
- Bulk student actions

---

## Telegram Bot

### Notifications
- Lesson reminder (configurable, e.g. 1 hour before)
- Homework assigned notification
- Homework due reminder

### Out of Scope (Later)
- Daily vocab word
- Low balance alert (when payment integration exists)
- Referral link sharing
- Streak/engagement nudges

---

## Content Structure

Physical materials to be digitized into structured format:

```
Course (e.g. "Beginner General English", "IELTS Prep")
  └── Level (A1, A2, B1, B2, C1)
       └── Unit (thematic grouping)
            └── Lesson
                 ├── Lesson guide (teacher-facing: what to teach, how, tips)
                 ├── Presentation content (screen-share materials)
                 └── Exercises (student-facing homework)
                      ├── Type: multiple_choice
                      ├── Type: fill_in_blank
                      ├── Type: matching
                      ├── Type: short_writing (teacher-graded)
                      └── Type: audio_listen_answer
```

Exercises are assigned per level by default. Data model supports overriding at the student level for future customization.

---

## Key Architectural Considerations

- **Scale target**: 1000+ students, design data model and APIs accordingly
- **CMS evolution**: content management starts as simple admin forms with structured data; must be replaceable with a full CMS builder later without data migration
- **Exercise customization**: fixed per level now, per-student overrides later — model both from the start
- **Payment integration**: not built now but the student model should have payment-related fields ready (status, expiry, package type)
- **Schedule view**: not in student app now but the data exists (lesson times, Zoom links) so adding a calendar view later is trivial
- **Group flexibility**: students can be moved between groups; a student can be in one group + have individual lessons simultaneously
- **Bilingual UI**: Uzbek + Russian from day one on all surfaces
- **Telegram Mini App constraints**: design exercises for mobile-first touch interaction; no drag-drop initially if it's unreliable on mobile — use tap-to-select alternatives

---

## What We're NOT Building

- Payment processing (manual via e-wallet)
- Scheduling engine (admin enters everything manually)
- Video/lesson platform (Zoom handles this)
- Marketing site / landing page
- Teacher recruitment pipeline
- In-app chat (Telegram DMs)
- Native mobile apps (Telegram Mini App for students, web for teachers/admin)
- AI features (AI-generated exercises, adaptive learning, etc.)
