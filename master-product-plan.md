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

Lessons happen on **Zoom (paid)**, 80 minutes each (group and individual). No in-app video for now. Zoom recordings enabled — shared via link for students who missed a lesson or want to review.

---

## Student App (Telegram Mini App)

### Onboarding
- Lead management and placement test handled in **amoCRM (Kommo)** — not in our app at launch
- Once placement test passed, student record is created in our system via amoCRM API integration (status: awaiting_assignment)
- Student appears in admin's Reception tab for group assignment
- Admin assigns to group → student status becomes "active" → student notified via Telegram
- Student data includes: name, phone, level, preferred day pattern (1,3,5 or 2,4,6), preferred time slot (7:00 / 8:30 / 10:00 / 11:30 / 13:00 / 14:30 / 16:00 / 17:30 / 19:00 / 20:30 / 22:00)
- **Later:** in-app placement test in Telegram Mini App, students enter our system at application stage

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

### Group Details (teacher's primary view per group)
- Student roster with per-lesson attendance tracking (teacher marks absent per lesson date)
- Total absent count per student
- Uncertain flag — teacher can mark students they feel are at risk of leaving (surfaces on admin's Uncertain List)
- Lessons paid per student (visible to teacher for awareness)
- Mid/Final exam dates — teacher manually sets these based on curriculum progress
- Comments per student

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

### Earnings
- Lessons completed this period
- Number of students per group (affects payout — per student-hour model)
- Expected payout amount

### Out of Scope (Later)
- Vacation management with auto-notification
- In-app chat with students
- Bonus/retention tracking
- Professional development modules

---

## Admin Panel (Next.js Web App)

Detailed in separate file: **admin-panel-plan.md**

Must-have tabs:
- **Main Schedule** — capacity grid (teachers × fixed time slots × day patterns). The operational pulse.
- **Group Details** — per-group student roster, CRM codes, payment status, uncertain flags
- **Reception** — student pipeline: placement test → follow-up calls → group assignment
- **No Payment List** — daily ops tool for tracking and reminding unpaid students (SMS reminders)
- **Student Management** — search/lookup any student, edit profile, move between groups, full history
- **Teacher Management** — profiles, availability, load overview, assignments

Later scope: Uncertain List, Exam List, Lost List, Payment List, Content Management, Analytics

---

## Notifications

Two channels:
- **SMS** — payment reminders (higher urgency/open rate). Routing configurable.
- **Telegram** — everything else

### Telegram Bot
- Lesson reminder (configurable, e.g. 1 hour before)
- Homework assigned notification
- Homework due reminder

### SMS
- Payment reminder (triggered from No Payment List in admin panel, single or multi-select)
- Fallback for students/parents without Telegram

### Out of Scope (Later)
- Daily vocab word
- Low balance alert (when payment integration exists)
- Referral link sharing
- Streak/engagement nudges

---

## Teaching Materials

Teachers manage materials themselves for now — physical Oxford Navigate textbooks + their own presentations shared via Zoom screen-share. No content management system at launch.

## Content Structure (for homework exercises in student app)

```
Course (e.g. "Beginner General English", "IELTS Prep")
  └── Level (Beginner, Elementary, Pre-intermediate, Intermediate, Upper-intermediate, Advanced)
       └── Unit (thematic grouping)
            └── Lesson
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
- **CMS evolution**: no content management at launch (teachers use physical textbooks). When we digitize, start with simple admin forms; must be replaceable with a full CMS builder later without data migration
- **Exercise customization**: fixed per level now, per-student overrides later — model both from the start
- **Payment integration**: not built now but the student model should have payment-related fields ready (status, expiry, package type)
- **Schedule view**: not in student app now but the data exists (lesson times, Zoom links) so adding a calendar view later is trivial
- **Fixed scheduling constraints**: 11 time slots × 2 day patterns. Keeps scheduling manageable at scale. All lessons are 80 minutes.
- **amoCRM (Kommo) integration**: leads managed in amoCRM up to placement test. Student record created in our DB after placement passed (API polling at launch, webhooks later). Student entity supports full lifecycle: awaiting_assignment → active → inactive
- **CRM codes**: every student gets a unique CRM code (plain sequence number, e.g. "1", "42") used as identifier across all surfaces
- **Single student entity**: one record per student, surfaced in multiple views (Reception, Student Management, Group Details, No Payment List) via status/filter — not separate tables
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
