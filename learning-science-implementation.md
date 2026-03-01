# Learning Science Implementation Plan

What we build on top of Oxford Navigate materials, based on evidence-based research.

Navigate handles the curriculum — lesson content, workbook exercises, audio/video, teacher guides. Our platform is the memory, adaptation, and engagement layer that makes it stick.

---

## 1. Spaced Repetition Vocabulary System

After each lesson, new vocabulary is added to the student's personal SRS queue.

**Per-word data:**
- English word
- Uzbek translation
- Russian translation
- Example sentence from the lesson
- Audio pronunciation

**Algorithm (SM-2):**
- First correct review: 1 day later
- Second correct review: 6 days later
- Third+ correct: previous_interval × ease_factor
- Ease factor starts at 2.5, adjusts per recall quality (0-5 scale), minimum 1.3
- If wrong: reset interval to 1 day, keep current ease factor

**Rules:**
- Cap at 10-15 new words per day
- Prioritize reviews over new items (reviews first, then new words if review queue is clear)
- Daily 5-10 minute flashcard sessions in Telegram Mini App
- A word is "mastered" after 3+ correct recalls at increasing intervals
- If review backlog exceeds threshold (~50 items), pause new words until caught up
- Show students their upcoming review count so they can plan

---

## 2. Retrieval-Based Homework Design

Every homework session mixes current unit with spaced retrieval from past units. Navigate workbook is linear (unit by unit) — we add the interleaving and retrieval layers.

**Session structure (15-20 minutes, 15-25 exercises):**

```
[Retrieval warm-up]         3-5 exercises from previous units (spaced)
[Current unit exercises]    8-12 exercises from Navigate workbook (digitized)
[Stretch]                   2-3 exercises previewing next unit
[End quiz]                  2-3 quick recall questions on today's material
```

**Exercise mix within a session (interleaved, not grouped by type):**
- Vocabulary cloze (fill-in-blank)
- Grammar cloze
- Listening + answer
- Dictation
- L1→L2 translation (Uzbek/Russian → English)
- Matching (only for brand-new vocabulary introduction)
- Sentence building / word ordering

**Difficulty calibration per session:**
- 20% easy (confidence builders, mastered material)
- 60% target zone (edge of competence)
- 20% stretch (slightly above current level)
- Target overall session success rate: 80-85%
  - Below 70% → too hard, student gets frustrated → add scaffolding (word banks, hints, easier exercises)
  - Above 90% → too easy, no real learning → remove scaffolding, increase difficulty
  - 80-85% → sweet spot: student feels competent but is still challenged

**Scaffolding = temporary support that fades as the student improves.**
Example progression for the word "opportunity":
1. Multiple choice — pick from 4 options (full scaffold)
2. Fill-in-blank with word bank visible (reduced)
3. Fill-in-blank with first letter hint: "o________" (minimal)
4. Translate from Uzbek/Russian → English, type freely (no scaffold)

**Exercise type guidelines:**
- At least 60% of exercises should be production (cloze, translation, dictation, writing) not recognition (multiple choice, matching)
- Multiple choice: limit to 30-40% of exercises, ALWAYS show immediate feedback after each question to prevent negative suggestion effect (exposure to wrong answers creating false memories)
- Matching: only for initial vocabulary introduction, always followed by production exercises on same content

---

## 3. Immediate Per-Exercise Feedback

Every auto-gradeable exercise shows result immediately after submission, not at end of session.

**By exercise type:**
- Multiple choice: correct answer + brief explanation (mandatory — counteracts false memory from wrong options)
- Cloze / fill-in-blank: accept multiple valid answers, show model answer
- Dictation: show correct text, highlight differences
- Translation: show model translation, note acceptable alternatives
- Writing: auto-flag grammar/spelling errors, teacher reviews content at next lesson

Research basis: End-of-question feedback produces significantly higher scores than end-of-assignment feedback.

---

## 4. Dictation Exercises

Not included in Navigate. One of the most effective and underused exercise types — integrates listening, writing, grammar, vocabulary, and spelling simultaneously.

**Source material:** Navigate's audio materials (dialogues, listening passages).

**Three difficulty levels:**
1. **Partial dictation** — transcript with gaps, student fills while listening
2. **Full dictation** — listen and type the whole sentence
3. **Delayed dictation** — listen, wait 10 seconds, then type from memory (adds working memory and chunking practice)

**Auto-grading:** Fuzzy matching that accepts minor spelling variants. Allow 2-3 replays with decreasing support.

---

## 5. Streak System

Cheapest, highest-ROI engagement feature. Duolingo data: 14% boost in 14-day retention.

**How it works:**
- Student completes daily homework or flashcard review → streak increments
- Displayed prominently in Telegram Mini App
- "Streak freeze" — one free pass per week (reduces anxiety from missing a day)
- Milestone celebrations: 7, 30, 60, 100 days
- Telegram bot reminder: "Your 15-day streak is at risk! 5 minutes of review will save it."

---

## 6. Progress Dashboard

Navigate has unit tests. We provide ongoing visibility into real learning metrics.

**Show (motivating and actionable):**
- CEFR progress bar — "You're 65% through A2" based on units completed + exercise performance
- Words mastered — count at SRS mastery level
- Homework streak — days of consecutive practice
- Skill breakdown — grammar %, vocabulary %, listening % (derived from exercise performance)
- Weak areas — "You struggle with: present perfect, articles" (auto-detected from error patterns)

**Do not show:**
- Points / XP (meaningless vanity metric)
- Comparison to other students (demotivating for weaker students)
- Raw error counts

---

## 7. Error Tracking & Weak Area Detection

Navigate treats all students the same. We adapt.

**How it works:**
- Log every exercise attempt: exercise type, grammar/vocab topic, correct/incorrect, time taken
- After ~50 exercises, auto-identify patterns: "This student gets articles wrong 40% of the time"
- Surface weak areas to teacher in their dashboard: "Student X struggles with: present perfect vs past simple, countable/uncountable nouns"
- Later (P2): auto-generate additional targeted exercises for identified weak areas

---

## 8. Lesson Structure Enforcement (Teacher Side)

Navigate has good lesson plans. We add time structure and retrieval from past units.

**50-minute lesson template (overlaid on Navigate lesson plan):**

```
[00:00-05:00]  Warm-Up & Retrieval         5 min   10%
               3-5 retrieval questions from past units (not current unit)
               "What do you remember about [topic from 2 weeks ago]?"

[05:00-15:00]  Presentation / New Input    10 min   20%
               Follow Navigate teacher's guide for the unit
               New vocabulary/grammar presented in context

[15:00-30:00]  Controlled Practice         15 min   30%
               Navigate exercises + supplementary platform exercises
               Accuracy focus, scaffolding provided

[30:00-42:00]  Free Production             12 min   24%
               Navigate speaking tasks, role plays, discussions
               Student talks MORE than teacher
               Teacher notes errors but does not interrupt

[42:00-47:00]  Review & Error Correction    5 min   10%
               Address errors from production phase (delayed correction)
               Student self-corrects where possible
               "What did we learn today?" (retrieval)

[47:00-50:00]  Homework Bridge              3 min    6%
               Assign platform homework
               Explain why each exercise type matters
               "15-20 minutes tonight, another 15-20 tomorrow"
```

**Critical ratio:** Student produces language for 54%+ of lesson time (27+ minutes). If teacher is talking more than student, the balance is wrong.

**Teacher tips built into lesson guide:**
- "At this point, stop talking. Let the student/group work."
- "Note errors during this phase but save correction for review."
- "Common mistake at this point in Navigate Unit X: [specific error]"

---

## 9. Between-Lesson Engagement (Telegram Bot)

Navigate only exists during lesson time and homework. The brain consolidates learning during the gaps between sessions. Short daily touchpoints dramatically outperform weekly sessions.

**Daily notifications:**
- Vocabulary review reminder — "5 words to review today" (from SRS queue)
- Homework reminder — "You have 12 exercises due. Takes ~15 min."
- Streak nudge — "Keep your 23-day streak alive!"

**Later (P2):**
- Word/chunk of the day — one collocation from the current unit with example
- Weekly progress summary — "This week: 4/5 homework sessions done, 12 new words mastered"

---

## Key Research Numbers Behind These Decisions

| Decision | Research Basis |
|----------|---------------|
| SRS for vocabulary | Ebbinghaus forgetting curve; Settles 2016 (HLR cut error rate by ~50% vs Leitner); FSRS achieves 20-30% fewer reviews than SM-2 |
| 10-15 new items/day cap | Anki power user data: above 20, review backlogs cause quitting |
| 15-20 min daily homework | Cognitive load research: attention drops after 25 min; spacing effect: daily short > weekly long |
| 80-85% target success rate | Desirable difficulties (Bjork): below 70% = frustration, above 90% = no growth |
| 60%+ production exercises | Retrieval practice (Adesope 2017, g=0.60): producing > recognizing |
| Immediate per-exercise feedback | Yang 2021 meta-analysis (d=0.499); negative suggestion effect requires MC feedback |
| Interleaved homework | Rohrer & Taylor 2007: interleaved students scored 43% better on delayed tests |
| Dictation exercises | Integrates 5 skills simultaneously; students using dictation had significantly higher vocabulary scores |
| Retrieval from past units | Roediger & Karpicke 2006: tested group forgot 13% vs restudied group forgot 56% after 1 week |
| Streak system | Duolingo A/B test: 14% boost in day-14 retention |
| Student produces 54%+ of lesson | Bloom 1984 (2-sigma problem): tutoring effectiveness comes from student doing, not teacher telling |
| Error pattern tracking | Deliberate practice (Ericsson): targeted work on specific weaknesses with feedback |
| Scaffolding that fades | Hattie 2009: scaffolding effect size d=0.82; word bank → hint → no hint → free production |
