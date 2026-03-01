# Learning Science in Language Learning Platforms
## Implementation-Focused Analysis for Platform Development

---

## 1. Duolingo's Learning Science

### Core Principles Implemented

Duolingo's learning engine rests on four cognitive science pillars:

1. **Spaced Repetition (the Spacing Effect)** -- Short practices spaced over time beat cramming. Goes back to Ebbinghaus (1885) and the forgetting curve.
2. **The Lag Effect** -- Gradually increasing spacing between reviews produces even stronger retention than fixed-interval spacing.
3. **Retrieval Practice (the Testing Effect)** -- Asking learners to produce answers from memory, not just recognize them, strengthens long-term encoding.
4. **Interleaving** -- Mixing different skill types and question formats within a single session improves flexible application and reduces boredom.

### Half-Life Regression (HLR) Algorithm

Duolingo's spaced repetition uses a custom model called **Half-Life Regression**, published at ACL 2016 by Burr Settles. Key details:

- The model estimates a **"half-life"** for each word in each learner's memory -- the time at which there is a 50% chance the learner has forgotten it.
- It combines psycholinguistic features (word frequency, cognate status, number of prior exposures, time since last seen, accuracy history) with machine learning (logistic regression with regularization).
- The formula: `p = 2^(-delta/h)` where `p` = recall probability, `delta` = time elapsed, `h` = half-life.
- Half-life `h` is estimated via: `h = 2^(theta . x)` where `theta` is the learned weight vector and `x` is the feature vector for that word-learner pair.
- **A/B test results**: 9.5% higher retention in practice sessions, 1.7% in lessons, 12% in overall activity compared to heuristic scheduling.

### Birdbrain System (Exercise Selection)

Duolingo's internal system called **Birdbrain** handles real-time exercise selection:

- Uses **logistic regression** to estimate the probability of a learner getting each exercise correct.
- Generates a **difficulty score** for each concept per learner.
- The **Session Generator** selects from ~200 candidate exercises per lesson, using Birdbrain's probability thresholds to pick challenges at the right difficulty.
- Processes ~15 billion exercises per week; the student model updates ~3,000 times per second.
- Tracks statistics on every word taught: exposure count, accuracy, time since last review.

**Implementation takeaway**: Build a per-item, per-learner difficulty model. Even simple logistic regression with features like (days_since_seen, times_seen, times_correct, item_difficulty) dramatically outperforms fixed schedules.

### Session Length Research

- Duolingo A/B tested making lessons shorter. Result: **shorter sessions did NOT help** -- they hurt overall learning quality.
- Adding new content (longer learning path) had a positive impact.
- Duolingo's internal target: optimize for **at least 15 minutes of quality learning time per day**.
- They developed a metric called **"Time Spent Learning Well"** -- time in activities that advance learning, not just any time in-app.

**Implementation takeaway**: Don't make homework sessions too short (under 10 min). Aim for 15-20 minute sessions. Measure "time learning well," not just engagement time.

### Gamification Effectiveness

- **Streaks**: Users offered a streak wager see a **14% boost in day-14 retention**. The streak is Duolingo's single most powerful retention mechanic.
- **Leaderboards**: Increase time spent learning; competitive structures benefit high-performing students most.
- **XP/Points**: Create sense of progression; most effective when tied to actual learning outcomes.

**Critical caveat from research**: Gamification's effectiveness is mixed. The most consistent predictor of impact is **alignment between game mechanics and learning objectives**, not the mere presence of points/badges. Leaderboards can trigger disengagement in struggling students.

### Published Efficacy Research (2024)

- Learners who completed A2-level Duolingo English courses scored **Intermediate High** in reading and listening (surpassing expected Intermediate Mid).
- Spanish learners completing beginner content achieved Intermediate Mid overall, with reading at Intermediate High.
- Writing and speaking lagged behind (Intermediate Low and approaching Intermediate Low respectively).

**Implementation takeaway**: App-based learning reliably develops reading/listening. Speaking and writing need explicit production exercises with feedback.

---

## 2. Anki / SuperMemo: The SM-2 Algorithm

### SM-2 Algorithm -- Exact Calculations

The SM-2 algorithm tracks three variables per card:

| Variable | Description | Initial Value |
|----------|-------------|---------------|
| `n` | Repetition number (successful recalls) | 0 |
| `EF` | Easiness Factor (controls interval growth) | 2.5 |
| `I` | Inter-repetition interval (days) | 0 |

**Quality Rating**: After each review, the learner rates quality `q` from 0-5:
- 0 = complete blackout
- 1 = wrong, but recognized correct answer
- 2 = wrong, but correct answer seemed easy to recall
- 3 = correct with serious difficulty
- 4 = correct after hesitation
- 5 = perfect response

**Interval Calculation (when q >= 3, i.e., correct)**:
```
if n == 0:  I = 1 day
if n == 1:  I = 6 days
if n >= 2:  I = I_prev * EF
```

**Easiness Factor Update (after every review)**:
```
EF_new = EF_old + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
```
Minimum EF = 1.3 (Anki enforces 1.3; SuperMemo research shows below 1.3 produces excessive reviews).

**If q < 3 (incorrect)**: Reset `n` to 0, restart from I=1 day, but keep the current EF.

**Worked Example**:
- New word, first correct review (q=4): I = 1 day, EF = 2.5 + (0.1 - 1*0.10) = 2.5
- Second correct review (q=4): I = 6 days, EF = 2.5
- Third correct review (q=4): I = 6 * 2.5 = 15 days, EF = 2.5
- Fourth correct review (q=3): I = 15 * 2.36 = 35 days, EF = 2.5 + (0.1 - 2*0.14) = 2.36

### FSRS: The Next-Generation Algorithm (Anki 23.10+)

As of 2023, Anki integrated **FSRS (Free Spaced Repetition Scheduler)** as an optional replacement for SM-2:

- Developed by Jarrett Ye using machine learning trained on **700 million reviews from 20,000 users**.
- Based on the **Three Component Model of Memory** (Difficulty, Stability, Retrievability).
- Key advantage: **learns individual memory patterns** instead of using one formula for everyone.
- Benchmark result: **20-30% fewer reviews for the same retention rate** compared to SM-2.

**Implementation takeaway**: If building a new platform, implement FSRS or a similar ML-based scheduler from the start. If starting simple, SM-2 is a solid baseline -- just ensure EF floors at 1.3 and offer 4+ quality ratings.

### What Makes Anki Power Users Succeed vs. Those Who Quit

**Success factors**:
- Start with **10-20 new cards per day maximum** (not 50+)
- Use learning steps of "1m 10m 1d" or "10m 1d 3d" (NOT default "1m 10m" which is too short for language learning)
- Target **85-90% retention rate** (high enough to feel rewarding, low enough to avoid excessive reviews)
- Create cards with context sentences, not isolated words
- Use cloze deletions and sentence cards, not just word-translation pairs

**Why people quit**:
- Adding 50+ new cards/day creates a 1,000+ review backlog within days
- Default settings produce cards that come back too frequently or not enough
- No context on cards = meaningless rote memorization
- Review pile grows faster than the user can handle

**Implementation takeaway**: For any SRS-based homework system, cap new items per day (default 10-15, max 20). Show projected review load. Auto-adjust if reviews pile up.

---

## 3. Busuu's Community Feedback Approach

### How Native Speaker Feedback Works

- Learners submit written or spoken exercises.
- Native speakers from the community review and leave comments.
- Learners reciprocate by correcting others learning their native language.
- **75% of learners** rate community feedback as "very helpful."

### Limitations Discovered

- Nothing stops non-native speakers from reviewing (anyone who lists the language as "known" can correct).
- Popular languages (English, Spanish) get overloaded with corrections; less common languages get sparse feedback.
- Quality control is informal -- no training or calibration for reviewers.

### Blended Learning Research Results

- Busuu's 2021 efficacy study: **92% of participants reported learning a language** successfully.
- Compared to a typical US college semester (90-110 hours of instruction), Busuu participants showed comparable improvements in **28-76 hours**.
- **Speech improvements were most noticeable** after consistent weekly community submissions combined with targeted grammar reviews.
- Beginner and intermediate learners showed "rapid and significant improvements" in both reading/grammar comprehension and speaking.

**Implementation takeaway**: Peer review from native speakers is powerful for writing and speaking BUT requires quality controls: reviewer training, rating of reviewer quality, minimum reviewer qualifications, and fallback to teacher review for low-volume languages.

---

## 4. Memrise's Approach

### Three-Pillar Learning Model

1. **Native Speaker Videos**: Short clips of real speakers saying phrases naturally. Exposes learners to authentic pronunciation, mouth movements, facial expressions, and speaking pace.

2. **Mems (User-Generated Mnemonics)**: Learners create and share mnemonic devices -- funny images, puns, phonetic associations. Based on:
   - **Dual Coding Theory**: Combining verbal and visual encoding strengthens memory.
   - **Method of Loci / Personal Association**: Linking new information to familiar concepts.
   - Community voting surfaces the best mems.

3. **Spaced Repetition**: Flashcard-based SRS similar to SM-2. Words you struggle with appear more frequently.

### Unique Design Choices

- **Speed Review mode**: Forces quick recall under time pressure, building automaticity.
- **Listening-first approach**: Videos play before text, prioritizing auditory processing.
- **Context-rich cards**: Words presented within real-world video context, not in isolation.

**Implementation takeaway**: Video of native speakers provides massive value for pronunciation and real-world comprehension. Allow user-generated memory aids (mnemonics) with community voting. Combine these with SRS for vocabulary that sticks.

---

## 5. Pimsleur's Graduated Interval Recall

### The Method

Pimsleur's 1967 memory schedule uses specific intervals:

```
5 sec -> 25 sec -> 2 min -> 10 min -> 1 hour -> 5 hours -> 1 day -> 5 days -> 25 days -> 4 months -> 2 years
```

This is a fixed, expanding-interval schedule baked into the audio lesson structure (not adaptive per-learner).

### Lesson Structure (30-minute audio lessons)

1. **Opening dialogue** in the target language (1-2 min)
2. **Breakdown**: Instructor dissects phrases, teaches components (5-8 min)
3. **Graduated recall cycles**: New vocabulary introduced and prompted at increasing intervals throughout the lesson (15-20 min)
4. **Recombination**: Learner constructs new sentences from known components (5 min)
5. **Next lesson preview**: Bridges to next lesson's content

### Why It Works for Speaking

- **Audio-only, production-focused**: Learner must speak aloud every ~30 seconds. No passive listening.
- **Oral before literate**: Matches natural language acquisition order (listening/speaking before reading/writing).
- **Anticipation principle**: Learner is prompted to answer BEFORE hearing the correct response, forcing retrieval practice.
- **Limited new material per lesson**: Only ~20-30 new items per lesson to avoid cognitive overload.

### Effectiveness Data

- After 8 weeks, **83% of participants** who completed all 30 lessons improved their oral-proficiency rating by at least one ACTFL level.
- 73% of those who studied for at least 8 hours also advanced.

**Implementation takeaway**: For speaking skill development, force active production (not just recognition). Prompt recall BEFORE revealing the answer. Keep new vocabulary per session to 20-30 items. Space recall within a single session at expanding intervals.

---

## 6. Rosetta Stone's Immersion Approach

### "Dynamic Immersion" Method

- Uses image-audio-text matching without L1 translation.
- Learners deduce meaning from visual context, repetition, and pattern recognition.
- Based on Stephen Krashen's **Natural Approach / Input Hypothesis**.

### What Research Supports

- Context-based learning activates deeper processing than rote translation.
- Incidental vocabulary learning (learning from context) does occur and produces durable memories.
- Visual association is effective for concrete nouns and actions.

### What Research Contradicts

- **Adult learners need explicit instruction** -- pure immersion without grammar explanation is less efficient for adults than a balanced approach.
- The Natural Approach "is no longer widely employed" in current SLA research.
- **Abstract concepts, grammar rules, and cultural nuances** cannot be reliably taught through images alone.
- Lack of explanations becomes increasingly problematic at intermediate+ levels.
- Independent studies found Rosetta Stone alone "won't get learners to confident conversation."

**Implementation takeaway**: Use visual/contextual learning as ONE tool, not the entire approach. Provide optional L1 explanations and grammar notes. Pure "no translation" immersion is inefficient for most adult learners. A blended approach (immersion + explicit instruction when needed) outperforms either extreme.

---

## 7. ELSA Speak: AI Pronunciation Feedback

### How It Works Technically

1. **Proprietary ASR** trained on 200+ million hours of accented speech from 195 countries.
2. **Phoneme-level analysis**: Breaks speech into individual sounds (not just word-level matching).
3. **Comparison to native speaker model**: Each phoneme is scored against a native reference.
4. **Color-coded feedback**:
   - Green = correct
   - Yellow = close but needs work
   - Red = significant error
5. **Multi-dimensional scoring**: Pronunciation, intonation, fluency, word stress, rhythm scored separately.

### Learning Science Perspective

- **Immediate corrective feedback** on pronunciation is critical -- learners cannot self-correct what they cannot hear.
- **Visual feedback** (color coding, spectrograms) activates dual coding, helping learners "see" their pronunciation errors.
- **Phoneme-level granularity** enables targeted practice on specific problem sounds rather than repeating entire phrases.
- **95%+ accuracy** in error detection (self-reported by ELSA).

### Limitations from Research

- ASR-based feedback is **less effective for rhythm and intonation** than for segmental sounds (individual phonemes).
- Frequent negative feedback can **decrease motivation and confidence** -- must be balanced with encouragement.
- **Accent bias**: Models trained primarily on one accent (American English for ELSA) may penalize legitimate accent variation.

**Implementation takeaway**: If building pronunciation feedback, invest in phoneme-level ASR, not just word-level. Provide visual + audio feedback. Balance error correction with positive reinforcement. Score multiple dimensions separately (sounds, stress, intonation, fluency).

---

## 8. Skyeng's Platform

### Adaptive Content System

- At the introductory lesson, students take a **placement test**; the teacher creates a customized course program based on goals and interests.
- AI-powered **lesson auto-generation**: Creates personalized interactive lessons based on student's level, interests, goals, and chosen topic in 2-6 minutes.
- **Skill graph** (implemented mid-2025): Records results of every exercise to automatically determine degree of skill acquisition and identify problem areas, enabling task recommendations without additional teacher input.

### Homework System Design

- Subject switcher allows students to find assignments and switch between studying different subjects.
- Self-study materials include: homework exercises, word games, audiobooks, writing essays.
- Homework is completed between teacher sessions and reviewed in the next lesson.

### Teacher-Platform Integration

- Teachers have access to: interactive whiteboard, translator, dictionary, video call platform.
- Teachers can build lessons around any topic; the platform provides supporting materials.
- The system tracks student progress and surfaces problem areas for teacher attention.

**Implementation takeaway**: The skill graph concept is powerful -- track every exercise result per student, map it to a skill taxonomy, and use it to automatically identify weak areas and recommend focused practice. Combine adaptive homework with teacher oversight.

---

## 9. Exercise Types: What Research Shows

### Cloze / Fill-in-the-Blank

**Effectiveness**: HIGH for vocabulary and grammar.
- Forces **productive recall** (not just recognition), which is harder but produces stronger memories.
- Research classification: **cued recall** -- more effective than recognition tests (multiple choice), less effective than free recall.
- Promotes vocabulary usage, grammatical knowledge, and structural recognition.
- L2 vocabulary gains are significant when cloze is combined with teacher interaction.

**Implementation**:
- Use sentence-level cloze (not isolated word blanks).
- Provide the surrounding sentence as context.
- For grammar: remove the target structure. For vocabulary: remove the target word.
- Accept multiple correct answers where appropriate.
- Gradually increase difficulty: word bank -> first letter hint -> no hint.

### Multiple Choice

**Effectiveness**: MODERATE but with important risks.
- **Positive**: Retrieval practice effect still applies. Easy to auto-grade. Reduces test anxiety.
- **CRITICAL RISK: The Negative Suggestion Effect** -- Exposure to incorrect alternatives can CREATE false memories. When learners choose wrong "lure" answers, they may later believe the lure was correct.
- Research (Roediger & Marsh): Multiple-choice testing increases production of lure answers on subsequent recall tests, even when students are warned against guessing.
- **Mitigation**: Providing feedback after MC questions "enhances the positive effects and reduces the negative effects" (Hypercorrection Effect).

**Implementation rules**:
- ALWAYS provide immediate feedback after MC questions (correct answer + brief explanation).
- Use MC primarily for **recognition-stage learning** (early exposure), then graduate to production exercises.
- Make distractors plausible but clearly wrong (avoid ambiguous options).
- Limit MC to no more than 30-40% of total exercises.
- Never use MC as the final exercise type for a skill -- always follow up with production.

### Translation Exercises

**Effectiveness**: MODERATE-HIGH when used strategically.

**Pros**:
- L2->L1 translation forces deep engagement with meaning (deeper than "intensive reading").
- L1->L2 translation reveals patterns of L1 interference and forces production.
- Lower-level learners benefit most from translation-based writing practice.
- Translation happens naturally in all learners' minds; leveraging it is more efficient than suppressing it.

**Cons**:
- Can create L1 dependency if overused.
- Oversimplifies nuances that don't translate directly.
- May reduce confidence in L2-only communication.

**Implementation**:
- Use L1->L2 translation for production practice (harder, more effective).
- Use L2->L1 translation for comprehension checking (easier, good for early stages).
- Provide "model translations" after submission (multiple acceptable versions).
- Phase out translation exercises as proficiency increases -- replace with L2-only production.

### Free Writing

**Effectiveness**: HIGH for advanced production, but needs feedback.
- Develops fluency, creativity, and complex sentence construction.
- Without feedback, errors can fossilize.
- Cognitive load is high -- inappropriate for beginners.

**Implementation**:
- Introduce free writing at B1+ levels.
- Provide structured prompts (not fully open-ended).
- Combine auto-grading (grammar/spelling) with human/peer review (content/naturalness).
- Start with guided writing (sentence completion, paragraph expansion) before fully free writing.

### Listening Comprehension

**Effectiveness**: HIGH -- essential skill that needs dedicated practice.

**Effective formats (research-backed sequence)**:
1. **Pre-listening**: Establish topic, preview key vocabulary.
2. **First listen**: Global comprehension (main idea, gist questions).
3. **Second listen**: Detailed comprehension (specific information, fill-in-blank).
4. **Post-listening**: Discuss, compare notes, respond to content.

**Exercise types by effectiveness**:
- **Gap-fill while listening (dictation-style)**: Very effective -- trains bottom-up decoding.
- **True/False with justification**: Tests comprehension + forces production.
- **Sequence ordering**: Tests narrative comprehension.
- **Multiple choice**: Good for testing inference and pragmatic meaning.
- **Open-ended response**: Highest cognitive load, best for advanced learners.

**Implementation**: Always allow multiple listens. Use authentic speech (native speakers, natural pace). Grade difficulty by: speech rate, background noise, vocabulary complexity, accent variety.

### Speaking / Pronunciation Exercises

**Effectiveness**: HIGH for the specific skill of speaking (which lags in app-only learning).

**Research findings**:
- ASR-based practice with feedback improves pronunciation quality.
- The **production effect**: Vocalization enhances memorization of L2 forms and meanings, persistent over one-week delays.
- Corrective feedback is "a necessary condition for foreign language acquisition."
- BUT: frequent error feedback can decrease motivation -- balance is critical.

**Implementation**:
- Require spoken production (not just listening).
- Provide phoneme-level feedback where possible.
- Use "shadow reading" (listen then repeat) as a warm-up.
- Build from controlled (repeat after model) to free (answer a question, describe an image).
- Show positive scoring first, then areas for improvement.

### Sentence Building / Word Ordering

**Effectiveness**: MODERATE-HIGH for syntax learning.
- Forces attention to word order, which is a production task.
- Less cognitively demanding than free production but more than recognition.
- Particularly effective for languages with different word order from L1.

**Implementation**:
- Provide shuffled words from a correct sentence.
- Include 1-2 distractor words at higher levels.
- Accept multiple valid orderings where grammar allows.
- Pair with audio: "Listen and arrange the words you hear."

### Matching Exercises

**Effectiveness**: LOW-MODERATE. Useful only for initial exposure.
- Primarily tests recognition, not production.
- Very low cognitive load -- good for confidence building and warm-up.
- Minimal long-term retention benefit compared to production tasks.

**Implementation**:
- Use matching ONLY for initial vocabulary introduction.
- Time-limited matching adds a desirable difficulty.
- Always follow matching with production-based exercises on the same content.
- Matching image-to-word is more effective than L1-to-L2 matching (avoids pure translation).

### Dictation

**Effectiveness**: HIGH -- one of the most underrated exercise types.
- Integrates listening, writing, spelling, grammar, and vocabulary simultaneously.
- Trains precise bottom-up listening skills (decoding every word).
- **Delayed dictation** (hear a chunk, write from memory) practices working memory and chunking.
- Research: Students using dictation had significantly higher vocabulary scores.
- **Running dictation** (listen, move, write) improves sentence-level grammar and paragraph construction.

**Implementation**:
- Start with single sentences, progress to short paragraphs.
- Allow replay (2-3 times) with decreasing support.
- Auto-grade with fuzzy matching (accept minor spelling variants).
- Use "partial dictation" (fill gaps in a transcript while listening) as an intermediate step.

---

## 10. Homework Design: What Research Says

### Optimal Amount

| Finding | Detail |
|---------|--------|
| **Daily sessions of 15-20 minutes** | Outperform weekly marathon sessions for language automaticity |
| **New items per session** | 10-15 optimal, 20 maximum; above this, review backlog crushes motivation |
| **Total exercises per session** | 15-25 exercises for a 15-minute session (roughly 40-60 seconds per exercise) |
| **Frequency** | Daily practice is dramatically better than 2-3x/week (spacing effect) |

### Immediate vs. Delayed Feedback

| Context | Recommended Approach |
|---------|---------------------|
| **Factual recall (vocabulary, grammar forms)** | Immediate feedback -- students learned more with instant feedback |
| **Production tasks (writing, speaking)** | Slight delay beneficial -- encourages self-monitoring and reflection |
| **Multiple choice** | MUST have immediate feedback to counteract negative suggestion effect |
| **End-of-question vs. end-of-assignment** | End-of-question feedback produces significantly higher post-test scores |
| **Desirable difficulty theory** | Delayed feedback can be better for long-term retention (slows initial learning but improves durability) |

**Implementation rule**: Default to immediate, per-exercise feedback. For writing and speaking, allow a brief self-review period (10-30 seconds) before showing feedback. Never batch all feedback to the end of a homework session.

### Auto-Graded vs. Human-Graded

| Exercise Type | Recommended Grading |
|---------------|-------------------|
| Vocabulary (MC, cloze, matching) | Auto-grade (immediate feedback) |
| Grammar (cloze, transformation) | Auto-grade with accepted-answer lists |
| Pronunciation | AI-grade (ASR) + periodic human review |
| Short writing (1-3 sentences) | Auto-grade (grammar/spelling) + periodic human review |
| Free writing (paragraph+) | Human or peer review required |
| Speaking fluency | AI initial score + human calibration |

**Key finding**: Auto-graded homework with immediate feedback is more effective than human-graded homework with delayed feedback for most exercise types, simply because of the feedback timing advantage.

### Mix of Easy vs. Hard (Difficulty Calibration)

Research-backed target: **~80-85% success rate** within a homework session.

- **Too easy (>90% correct)**: Learner gets bored, no growth, no desirable difficulty.
- **Sweet spot (80-85%)**: Learner feels challenged but competent. Optimal for long-term retention.
- **Too hard (<70% correct)**: Frustration, anxiety, risk of quitting.

**Implementation approach**:
```
Session structure (15-25 exercises):
- 20% Easy (confidence builders, review of mastered material)
- 60% Target zone (material at the edge of competence)
- 20% Stretch (slightly above current level, preview of upcoming material)
```

For interleaving: mix vocabulary, grammar, listening, and reading exercises within a single session rather than grouping by type. Research shows interleaved practice improves transfer to real conversations by up to 43%.

**Important nuance**: For low-achieving learners, start with more blocked practice (grouped by type) before transitioning to interleaving. Research (Hwang, 2025) found that "interleaving alone produced undesirable difficulty for low achievers."

---

## 11. Progress Tracking That Works

### Metrics That Actually Predict Success

| Metric | Predictive Value | How to Measure |
|--------|-----------------|----------------|
| **Streak / session consistency** | VERY HIGH -- strongest behavioral predictor | Days active in last 14/30 days |
| **Time Spent Learning Well** | HIGH -- quality time, not just app time | Time in exercises that advance learning (not review-only sessions) |
| **Recall accuracy trend** | HIGH -- should stay 80-85% or gradually improve | Rolling 7-day average of first-attempt accuracy |
| **Production vs. recognition ratio** | HIGH -- learners who produce more progress faster | % of exercises requiring typed/spoken output vs. MC/matching |
| **New items mastered per week** | MODERATE -- measures pace of new learning | Items reaching "known" status (e.g., 3+ correct in a row) |
| **Review completion rate** | MODERATE -- measures discipline | % of scheduled SRS reviews actually completed |
| **Vocabulary coverage** | MODERATE -- milestone-based | Words known out of target frequency list |

### Metrics That DON'T Predict Well (But Learners Love)

| Metric | Why It Misleads |
|--------|----------------|
| Total XP / points | Can be inflated by easy exercises, doesn't correlate with proficiency |
| Total time in app | Includes idle time, repeated easy content, browsing |
| Lessons completed | Completion != mastery; speed-running produces no retention |
| Words "seen" | Seeing a word once has near-zero retention value |

### What to Show Students

**Show (motivating and actionable)**:
- Current streak and streak history
- Skills mastered vs. skills in progress (visual skill tree/map)
- Accuracy trend over time (graph showing improvement)
- "Words you know well" count (based on SRS mastery threshold)
- Next milestone / CEFR level progress bar
- Specific weak areas with practice recommendations

**Hide or de-emphasize**:
- Raw error counts (demotivating)
- Comparison to other students (harmful for low performers)
- Total time spent (encourages padding, not quality)

**Implementation takeaway**: The single most important metric to track and display prominently is **the streak** -- Duolingo's data shows it has the largest impact on retention. Pair it with a skill-level progress indicator tied to real proficiency milestones.

---

## 12. Optimal Lesson Structure (50-Minute Language Lesson)

### Research-Backed Structure: PPP+ Model

The Presentation-Practice-Production (PPP) model is the most widely validated framework for structured language lessons. Below is an implementation optimized for a 50-minute online lesson:

### Phase 1: Warm-Up (5 minutes)
**Purpose**: Activate prior knowledge, transition brain to L2 mode, build rapport.

**Activities**:
- Quick review game on previously learned material (3 min)
- Brief Q&A using recently learned structures (2 min)
- Or: "What do you remember from last lesson?" retrieval prompt

**Key principle**: Retrieval practice. Starting with recall of prior material strengthens those memories while preparing the brain for new input.

### Phase 2: Presentation / Input (10 minutes)
**Purpose**: Introduce new language (vocabulary, grammar, functions).

**Activities**:
- Present new material in context (dialogue, text, video) -- NOT isolated rules
- Highlight target language within the context
- Provide explicit explanation (grammar rule, pronunciation guidance)
- Check comprehension with 2-3 quick concept-check questions

**Key principle**: Comprehensible input + explicit instruction. Adults learn fastest with a combination of meaningful input AND explicit metalinguistic explanation.

### Phase 3: Controlled Practice (15 minutes)
**Purpose**: Accuracy-focused practice with scaffolding.

**Activities**:
- Cloze exercises with the target structure
- Sentence transformation drills
- Guided dialogue practice (scripted with blanks)
- Matching and categorization of new vocabulary
- Listen-and-repeat for pronunciation

**Key principle**: Scaffolded production. Move from recognition to production with decreasing support. Accuracy is the goal at this stage.

### Phase 4: Freer Production (12 minutes)
**Purpose**: Fluency-focused practice where students use language creatively.

**Activities**:
- Role play or simulation using target language
- Information gap activities
- Discussion questions requiring target structures
- Describe-and-compare (images, situations)
- Problem-solving tasks in the target language

**Key principle**: Communicative competence. The teacher's role minimizes here. Errors are noted but not immediately corrected (delayed feedback for production tasks). Students need to experience using language freely.

### Phase 5: Review & Error Correction (5 minutes)
**Purpose**: Consolidate learning, address common errors, preview homework.

**Activities**:
- Teacher provides delayed error correction on errors observed during production
- Students self-correct where possible
- Quick recap: "What did we learn today?" (retrieval practice again)
- Preview of homework and next lesson topic

**Key principle**: Consolidation + forward cueing. Errors addressed after production (not during, which disrupts fluency). Previewing next lesson activates anticipation.

### Phase 6: Homework Bridge (3 minutes)
**Purpose**: Connect lesson to between-session practice.

**Activities**:
- Assign homework that reviews today's material + previews next lesson
- Explain the "why" behind each homework exercise
- Set expectation: "15-20 minutes tonight, another 15-20 tomorrow"

### Timing Summary

```
[00:00-05:00]  Warm-Up & Retrieval        (5 min)  -- 10%
[05:00-15:00]  Presentation & Input       (10 min)  -- 20%
[15:00-30:00]  Controlled Practice        (15 min)  -- 30%
[30:00-42:00]  Free Production            (12 min)  -- 24%
[42:00-47:00]  Review & Error Correction   (5 min)  -- 10%
[47:00-50:00]  Homework Bridge             (3 min)  --  6%
```

**Critical ratios**: Practice + Production should consume at least **54% of lesson time** (27 of 50 minutes). Presentation should never exceed 20%. If the teacher is talking more than the student, the balance is wrong.

---

## Summary: Top Implementation Priorities

If building a language learning platform, the highest-impact features based on this research are:

1. **Adaptive spaced repetition** (HLR or FSRS-level algorithm, not fixed intervals) -- this is the single highest-impact learning science feature.

2. **Per-exercise immediate feedback** -- especially critical for multiple choice (negative suggestion effect) and vocabulary exercises.

3. **Production-heavy exercise mix** -- at least 60% of exercises should require the learner to produce language (cloze, translation L1->L2, dictation, speaking), not just recognize it.

4. **Streak mechanic** -- the single most effective retention/engagement tool, backed by Duolingo's data (14% day-14 retention boost).

5. **15-20 minute daily sessions** with 10-15 new items -- this is the research-optimal homework dose. Cap new items to prevent review pile-up.

6. **Difficulty calibration to 80-85% success rate** -- adaptive difficulty targeting the "desirable difficulty" sweet spot per learner.

7. **Skill-level progress tracking** tied to real proficiency milestones (CEFR), not just points/XP.

8. **Dictation exercises** -- highly effective and underused in most platforms. Integrates listening, writing, grammar, and vocabulary.

9. **Speaking production with AI feedback** -- the biggest gap in most platforms. Even basic ASR + comparison to a model dramatically improves oral skills.

10. **Lesson structure enforcement** -- if the platform supports live lessons, enforce the PPP+ structure with time allocations (teacher talks <20%, student produces >54%).
