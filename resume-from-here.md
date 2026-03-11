⏺ Good, lots of meaningful updates. Let me go through each one and how it impacts
   the schema.                                                                 
                                                                                 
  ---                                                                          
  Impact Analysis                                                                
                                                                               
  1. Transfer & Lost Reasons

  Current schema has a single MembershipEndReason enum (TRANSFERRED, DROPPED,
  GROUP_MERGED, COMPLETED). This is now too coarse — we need two separate reason
  sets plus free-text for "other".

  Schema impact:
  - Replace MembershipEndReason with two separate enums: TransferReason and
  LostReason
  - Add an otherReason String? field for free-text when "other" is selected
  - The update also says "track how many lessons student has taken before
  transfer" — we already have lessonsStart on GroupMembership but need a
  lessonsCompleted Int? or lessonEnd Int? to calculate this

  2 & 3. Suggested Students / Suggested Groups

  These are query-based features — no new tables. But they reinforce that the day
   pattern and time slot storage must be query-friendly. If we store days as
  Int[], we can use Postgres array overlap (&&) to match students to groups
  efficiently. With enums, this is trivial for exact match but breaks the moment
  patterns diverge.

  4. First Lesson at 50% Price

  This is a trial/onboarding mechanic. Need to track:
  - Whether a student has taken their first lesson yet (globally, not per-group)
  - The discounted price for that lesson
  - Prevent accidentally assigning a trial student to a group as if they're a
  full member (occupying a seat)

  Schema impact: A trialStatus concept on Student or on GroupMembership. Could be
   as simple as isTrialStudent Boolean @default(false) on the student, or a
  LessonType concept (trial vs regular). This interacts with the payment model.

  5. Promotions

  Free first month, referral discounts, percentage-off deals. This is a
  fundamentally new domain.

  Schema impact: At minimum:
  - A Promotion model (type, discount value, conditions, active dates)
  - A StudentPromotion junction (which student has which promo, usage status)
  - Or simpler: a discountNote String? + discountPercent Decimal? on
  StudentPaymentPeriod if you want to keep it lightweight for now

  6. Time Slots: 7:00–20:00 with Lunch Break

  This is the biggest structural change. Current TimeSlot enum has 5 values. With
   80-min lessons + 10-min gaps starting at 7:00:
  ┌──────┬─────────────────────────┐
  │ Slot │          Time           │
  ├──────┼─────────────────────────┤
  │ 1    │ 7:00–8:20               │
  ├──────┼─────────────────────────┤
  │ 2    │ 8:30–9:50               │
  ├──────┼─────────────────────────┤
  │ 3    │ 10:00–11:20             │
  ├──────┼─────────────────────────┤
  │ 4    │ 11:30–12:50             │
  ├──────┼─────────────────────────┤
  │ —    │ 13:30–14:00 lunch break │
  ├──────┼─────────────────────────┤
  │ 5    │ 14:00–15:20             │
  ├──────┼─────────────────────────┤
  │ 6    │ 15:30–16:50             │
  ├──────┼─────────────────────────┤
  │ 7    │ 17:00–18:20             │
  ├──────┼─────────────────────────┤
  │ 8    │ 18:30–19:50             │
  ├──────┼─────────────────────────┤
  │ 9    │ 20:00–21:20             │
  └──────┴─────────────────────────┘
  That's 9 slots, almost double what we had. This alone kills the TimeSlot enum
  approach — it would need to go from 5 to 9 values immediately, and could change
   again.

  My recommendation: Store time slots as String ("07:00", "14:00") or Int
  (minutes from midnight: 420, 840). I'd lean toward String — it's
  human-readable, easily sortable, and doesn't need conversion for display. The
  set of valid slots is enforced at the application layer (Zod validation) rather
   than the database layer, which means adding/removing a slot is a code change,
  not a migration.

  7. Teacher-Style Attendance Grid in Admin Group Details

  No schema change — the Lesson + Attendance models already support this. It's
  purely a UI addition.

  8. Reception Filters

  UI concern. No schema change needed.

  9. Uncertain List Auto-Criteria

  Currently isUncertain is a manual boolean. Now some students should be
  auto-flagged based on:
  - Absences >= 3
  - Homework incompletion >= 3

  Two approaches:
  - Computed at query time — just count absences/incomplete homework in the
  query. No schema change. Simpler, always accurate, but slightly heavier
  queries.
  - Stored flag with source tracking — keep isUncertain but add a uncertainSource
   enum (MANUAL, AUTO_ABSENCE, AUTO_HOMEWORK). Update it via a cron or trigger.

  I'd lean toward computed for auto-criteria + keep the manual flag separate. The
   manual flag is a subjective gut feeling; the auto-criteria are objective
  counts. Mixing them into one boolean would lose information (if an admin
  removes the uncertain flag, should we re-add it because absence count is still
  >= 3?).

  Schema impact: Possibly add uncertainResolvedAt DateTime? and
  uncertainResolvedBy to track when admin has acknowledged/resolved an
  auto-flagged uncertain student.

  10. Individual Classes Priced Differently

  Currently IndividualLesson has no price field. Group pricing lives in
  StudentPaymentPeriod with amountDue.

  Schema impact: Need a per-lesson price on IndividualLesson, or a separate
  pricing model. Simplest: add pricePerLesson Decimal? to both Group and
  IndividualLesson, so payment calculations can reference the rate directly.

  ---
  Summary of Structural Changes
  ┌───────────────────────────────────┬──────────────────┬──────────────────────┐
  │              Change               │       Type       │       Urgency        │
  ├───────────────────────────────────┼──────────────────┼──────────────────────┤
  │ DayPattern enum → days Int[]      │ Fundamental      │ High — affects 5     │
  │                                   │ redesign         │ models               │
  ├───────────────────────────────────┼──────────────────┼──────────────────────┤
  │ TimeSlot enum → timeSlot String   │ Fundamental      │ High — 9 slots now,  │
  │                                   │ redesign         │ not 5                │
  ├───────────────────────────────────┼──────────────────┼──────────────────────┤
  │ Split MembershipEndReason into    │ Enum redesign    │ High                 │
  │ transfer + lost reasons           │                  │                      │
  ├───────────────────────────────────┼──────────────────┼──────────────────────┤
  │ Add lessonsCompleted to           │ New field        │ High                 │
  │ GroupMembership                   │                  │                      │
  ├───────────────────────────────────┼──────────────────┼──────────────────────┤
  │ Trial student tracking            │ New field(s)     │ Medium               │
  ├───────────────────────────────────┼──────────────────┼──────────────────────┤
  │ Promotions model                  │ New table(s)     │ Medium — can start   │
  │                                   │                  │ lightweight          │
  ├───────────────────────────────────┼──────────────────┼──────────────────────┤
  │ Pricing on IndividualLesson +     │ New fields       │ Medium               │
  │ Group                             │                  │                      │
  ├───────────────────────────────────┼──────────────────┼──────────────────────┤
  │                                   │ Architectural    │ Low — can be         │
  │ Uncertain auto-criteria           │ decision         │ computed at query    │
  │                                   │                  │ time                 │
  └───────────────────────────────────┴──────────────────┴──────────────────────┘
  The DayPattern → Int[] change you already spotted is now reinforced by updates
  #2, #3, and #6. And update #6 makes the TimeSlot enum equally problematic —
  we're going from a small fixed set to a much larger one that could keep
  evolving.

  What are your thoughts on these? Anything you want to dig into further, or
  should I also address how the promotions model should look?

✻ Sautéed for 1m 25s                 

❯ Prevent accidentally assigning a trial student to a group as if they're a      
    full member (occupying a seat) - we would still have to occupy a seat    
  for the first lesson student to avoid adding a student to a group from         
  reception. if for example there are 5 students and on is a first timer -       
  we shouldn't be able to add a student to that group from reception.            
  Promotions - we should have a percentage based and amount(in uzs uzbek         
  currency) based promotions with different reasons for promotions like for      
  example invite friend, we will have different names/types of promotions        
  but all of the would either be a percentage/amount based. time slots           
  should be flexible enough - now we have this structure of 80 mins block        
  but this could change - for example we could have 60 mins lessons for          
  individual groups, even the time could change for those classes - they         
  might require a 7:30 slot (we don't need it now but should architect to        
  allow that if needed in the future ). once done please summarize the           
  questions you'd like me to answer to make the technical decisions              
                                                                                 
⏺ Good clarifications. Let me refine my understanding and then compile the       
  decision questions.                                                            
                                                                                 
  Trial students — understood. They occupy a seat like anyone else. The tracking
  need is simpler than I initially framed: we just need to know "this student is 
  on their trial lesson" so the admin can see it (and so billing knows to apply  
  the 50% rate). The seat is occupied either way.

  Promotions — clear. Two discount mechanisms (percentage / fixed amount),
  various named types. Straightforward model.

  Time slots — this is the most significant architectural shift. If individual
  lessons can be 60 min and could start at 7:30, then the time slot isn't just
  "which of the 9 slots" — it's truly a free-form start time + variable duration.
   The Main Schedule grid becomes more interesting to render.

  ---
  Questions for You

  1. Day Representation

  I'm proposing days Int[] where 1=Monday through 7=Sunday. A group on
  Mon/Wed/Fri stores [1, 3, 5].

  Is that mapping intuitive for you, or do you prefer a different numbering?
  (This is ISO 8601 standard: 1=Mon, 7=Sun.)

  2. Time Slot Storage

  Two options given the flexibility requirement:

  - A) startTime String — store "07:00", "07:30", "14:00". Human-readable, easy
  to display. Sorted lexicographically, which works for times.
  - B) startTime Int — store minutes from midnight: 420 for 7:00, 450 for 7:30.
  Better for arithmetic (calculating overlaps, end times), but needs formatting
  for display.

  I lean toward A (String). Overlap checks can still be done at the application
  layer, and it avoids constant conversion. Any preference?

  3. Lesson Duration

  Currently all lessons are 80 minutes. But individual lessons could be 60 min,
  and this might change.

  Should durationMinutes live on:
  - A) The Group / IndividualLesson level — each group or individual arrangement
  has a fixed duration (e.g., "this group runs 80-min lessons, this individual
  arrangement runs 60-min lessons"). Simplest.
  - B) The Lesson (session) level — each individual lesson instance can have a
  different duration. More flexible but likely overkill.

  I lean toward A — duration is a property of the arrangement, not each session.

  4. Transfer & Lost Reasons — Enum vs Table

  The reason lists you gave (teacher dissatisfaction, too expensive, etc.) could
  grow over time. Two approaches:

  - A) Enums — TransferReason and LostReason enums in Prisma + an otherReason
  String? for free-text. Simple, type-safe, but adding a new reason = migration.
  - B) Reference table — a Reason model with rows. Admin can add new reasons from
   the UI without a deploy. More flexible but more complex.

  Given that only the co-founder is using this and reason changes are rare, A
  (enums) seems fine for now. Thoughts?

  5. Promotions — Scope of Application

  The structure is clear (name/type, percentage or fixed amount). But how does a
  promotion get applied?

  - A) Per payment period — a promotion is linked to a StudentPaymentPeriod.
  E.g., "first month free" means the student's first period has a 100% discount.
  "Invite friend 10% off" applies to a specific month.
  - B) Per student, ongoing — a promotion is linked to the student and applies to
   all future periods until it expires or is removed. E.g., "10% off for 3
  months."
  - C) Both — some promotions are one-time (free first month), some are recurring
   (referral discount for N months).

  I suspect C is the real answer. Should the promotion track how many months it
  applies for? (e.g., durationMonths Int? where null = one-time)

  6. Teacher Availability with Flexible Times

  Currently TeacherAvailability is (teacherId, dayPattern, timeSlot). With
  flexible days and times, this changes to something like (teacherId, dayOfWeek
  Int, startTime String) — one row per day-time combo the teacher is available.

  Or do you prefer a simpler model where availability is just "which days the
  teacher works" and the specific time slots are implicit from their
  group/individual assignments? This avoids maintaining availability separately
  from actual assignments.

  7. Main Schedule Grid — Display Logic

  With flexible days, the two-tab layout (MWF | TTS) doesn't work generically
  anymore. Options:

  - A) Keep grouping by common patterns — the UI detects the most common day
  combos and creates tabs for them. MWF and TTS are still the default, but a [6,
  7] group would show in a "Sat/Sun" tab.
  - B) Show a full 7-day week view — columns for each day, rows for teachers.
  More universal but more spread out.
  - C) Keep the current two-tab approach for now — groups that don't fit MWF/TTS
  get a third "Other" tab. Pragmatic since 95%+ of groups will still be MWF or
  TTS.

  This is a UI decision more than a data decision, but it affects whether we need
   to store a "pattern label" alongside the days array.

  8. Uncertain Auto-Criteria Thresholds

  You mentioned "absence over 3 times, homework incompletion over 3 times."
  Should these thresholds be:

  - A) Hardcoded in application logic (simplest, change = code deploy)
  - B) Configurable via a settings table (admin can tweak thresholds without a
  deploy)

  Given it's early stage, A seems fine — you can always add a settings table
  later. Agree?

  ---
  Those are the 8 decisions I need from you to finalize the schema changes. Most
  have a clear lean — let me know where you agree/disagree and I'll proceed.

✻ Worked for 57s

❯ 1. sounds good to me; 2. startTime String; 3. we if go with option A - we      
  could later add options on the same level right? grouplesson60,               
  individuallesson60?; 4. Reference table - because we don't yet know what       
  reasons to include - this allows flexibility to later add options              
  dynamically; 5. promotion examples could be 20% off of all beginner level      
  classes, invite friend get 10% on the whole level or one month, don't know     
   what other promotion types exist, do a research if needed and lets            
  discuss again; 6. we mostly like will ask all teachers to be available         
  during all days mon-sat - we could even force them to be available during      
  14-22 - but having the flexibility to have a more fine grained control         
  like for example teached A can only work mon/wed/fri 14-18:00 is good; 7.      
  for now let's do the mwf and tts layout as planned - will take care of the     
   edge cases later - our data models do allow for that, right?; 8. about        
  that you've proposed a cron job before? do you think we're better of           
  having it as query based for now? hardcoded in application logic for now -     
   not many tweaks expected.                                                     
                                                                                 
⏺ Quick answers on the clear ones, then let me research promotions.              

  #3 — Yes, exactly. Since durationMinutes is just an Int field (not an enum),   
  you can set it to 80, 60, 45, whatever — no migration needed. Just a different
  value per group or individual arrangement.                                     
                                                                               
  #7 — Yes, with days Int[] the data model supports any day combination. The
  MWF/TTS layout is purely a UI choice you can evolve later without touching the
  schema.

  #8 — Query-based is the right call for now. With <1000 students, counting
  absences/incomplete homework on the fly is negligible. No cron complexity,
  always accurate, and hardcoded thresholds are easy to change later.

  Now let me research promotion types for education platforms.

⏺ Task(Research education promotions)
  ⎿  Done (18 tool uses · 34.8k tokens · 3m 17s)                                 
                                                                                 
⏺ Good research. Here's what I found about promotions in language schools,       
  distilled to what's relevant for your platform:                                
                                                                                 
  ---                                                                            
  Promotion Types That Apply to Your Platform                                    
  Type: Trial/First Lesson                                                       
  Example: 50% off first lesson                                                  
  Mechanism: % off                                                               
  Duration: One-time                                                             
  ────────────────────────────────────────                                       
  Type: Referral
  Example: Invite friend, both get 10% off                                       
  Mechanism: % or fixed UZS                                                      
  Duration: One-time per referral                                                
  ────────────────────────────────────────
  Type: Seasonal
  Example: "New Year, New Language" Jan campaign
  Mechanism: % or fixed UZS
  Duration: One-time, time-limited
  ────────────────────────────────────────
  Type: Family/Sibling
  Example: 2nd child gets 10% off
  Mechanism: % off
  Duration: Recurring while both enrolled
  ────────────────────────────────────────
  Type: Win-Back
  Example: Churned student gets 15% off return month
  Mechanism: % or fixed UZS
  Duration: One-time
  ────────────────────────────────────────
  Type: Loyalty
  Example: After 6 months, 5% off ongoing
  Mechanism: % off
  Duration: Recurring once earned
  ────────────────────────────────────────
  Type: Early Payment
  Example: Pay 3 months upfront, 5% off
  Mechanism: % off
  Duration: One-time per prepayment
  ────────────────────────────────────────
  Type: Promo Code
  Example: General marketing codes
  Mechanism: % or fixed UZS
  Duration: Configurable
  Your operations playbook already mentions the 25% max discount cap and the
  win-back sequence (Day 30/45/60/90). The pricing strategy doc mentions 8/12/16
  lesson tiers with 10-20% bulk discounts — that's baked into pricing, not a
  "promotion."

  Key Observations

  1. Most promotions are one-time (apply to first payment or a specific month).
  Only family and loyalty are truly recurring.
  2. Scope varies — some apply to a specific level ("20% off all beginner
  classes"), some to a specific month, some globally.
  3. Stacking — industry standard is "no stacking" (one promotion per student per
   period). Your 25% cap is a good hard ceiling.

  Proposed Promotion Model

  Given all this, here's what I think makes sense:

  Promotion
    - name (e.g., "Invite Friend", "January Campaign 2026", "Sibling Discount")
    - type enum: REFERRAL, SEASONAL, FAMILY, WIN_BACK, LOYALTY, TRIAL,
  EARLY_PAYMENT, OTHER
    - discountType enum: PERCENTAGE, FIXED_AMOUNT
    - discountValue Decimal (e.g., 10.00 for 10%, or 50000.00 for 50k UZS)
    - scope: which level(s) it applies to, or null = all
    - maxUsesTotal: Int? (e.g., "first 50 students only")
    - maxUsesPerStudent: Int? (e.g., 1 = one-time)
    - isRecurring: Boolean (loyalty/family = true, most others = false)
    - recurringMonths: Int? (null = indefinite, 3 = applies for 3 months)
    - validFrom / validTo: DateTime? (for seasonal campaigns)
    - isActive: Boolean

  StudentPromotion (junction)
    - studentId
    - promotionId
    - appliedAt
    - expiresAt?
    - referredByStudentId? (for referral tracking)
    - monthsUsed: Int (for recurring promos with a limit)

  When creating a StudentPaymentPeriod, the system checks if the student has any
  active promotions and applies the discount (capped at 25%).

  Questions for You on Promotions

  1. Stacking policy — Can a student have multiple active promotions? E.g., a
  sibling discount + a seasonal campaign. If yes, do they stack additively (10% +
   15% = 25%) or only the best one applies? My suggestion: best single promotion
  wins, no stacking. Simpler and respects your 25% cap naturally.
  2. Level scoping — You mentioned "20% off all beginner level classes." Should
  promotions be scopeable to:
    - A specific level (Beginner, Elementary, etc.)
    - A specific group type (GROUP vs INDIVIDUAL)
    - Or both?
  3. Referral rewards — Should the referrer and referee get the same discount, or
   can they differ? (e.g., referrer gets 50k UZS credit, referee gets 10% off
  first month)
  4. Family/Sibling — Do you actually need this at launch, or is it a "nice to
  have"? It requires linking students into families (shared parent phone number
  could work as a natural key).
  5. Do you want admins to create/manage promotions from the admin panel? Or is
  it fine to seed them in the database for now, with admin panel management
  coming later?

✻ Baked for 4m 1s                                                                
   
❯ to your Questions for You on Promotions - what recommendation do you have?     
   if you were to asnwer these for me                                           
                                                                                 
⏺ Fair enough — here's my take on all five:                                      
                                                                                 
  1. No stacking. Best single promotion wins. A small school doesn't need a      
  promotion engine with stacking rules. One active promo per student per billing
  period, the system picks whichever gives the student the biggest discount. The 
  25% cap is naturally respected since no single promotion should exceed it    
  anyway. If the admin wants to give someone a special deal that combines two
  things, they just create a one-off promotion with the combined value.
  2. Scope by level and group type, both nullable. level Level? (null = all
  levels) and groupType GroupType? (null = both group and individual). Covers
  "20% off beginner classes" and "15% off individual lessons" without
  overcomplicating. No need for multi-level selection — if a promo applies to
  Beginner and Elementary, create two promotions or leave level null and limit it
   another way.
  3. Same discount for both referrer and referee. Simpler to explain to students
  ("invite a friend, you both get 10% off"), simpler to implement (one promotion
  record, applied to both students). Different reward amounts is a large-platform
   optimization that doesn't move the needle at your scale.
  4. Skip family/sibling at launch. You haven't mentioned it as a need, and it
  requires a "household" linking concept that adds model complexity for an edge
  case. When you do need it, the parent's phone number is a natural grouping key
  — students with the same parent phone are siblings. Can be added as a regular
  promotion type later without schema changes.
  5. Seed in DB for now, admin panel management later. Promotions change rarely
  (seasonal campaigns, maybe once a month). The co-founder asks you or a dev to
  add a row. Building a full CRUD UI for promotions is low ROI compared to the
  core operational tabs (schedule, groups, reception, payments). Add it to the
  admin panel when you have 5+ active promotions and it becomes tedious to manage
   via DB.

  ---
  So the simplified promotion model becomes:

  - Promotion — name, type, discountType (PERCENTAGE/FIXED_AMOUNT), value,
  optional level scope, optional group type scope, isRecurring, recurringMonths,
  validFrom/validTo, maxUsesPerStudent, isActive
  - StudentPromotion — links a student to a promotion, tracks usage, optional
  referrer reference
  - One active promo per student per period, best one wins
  - Admin manages promotions via DB for now

  Want me to proceed with finalizing the full schema changes? I have clear
  answers on everything now:
  Decision: Days
  Answer: Int[], 1=Mon through 7=Sun
  ────────────────────────────────────────
  Decision: Time slots
  Answer: startTime String (e.g. "07:00")
  ────────────────────────────────────────
  Decision: Duration
  Answer: durationMinutes Int on Group/IndividualLesson
  ────────────────────────────────────────
  Decision: Transfer/Lost reasons
  Answer: Reference tables
  ────────────────────────────────────────
  Decision: Promotions
  Answer: % or fixed UZS, no stacking, scoped by level/group type
  ────────────────────────────────────────
  Decision: Teacher availability
  Answer: Per-day + time range, flexible
  ────────────────────────────────────────
  Decision: Main Schedule UI
  Answer: MWF/TTS tabs for now, data supports any pattern
  ────────────────────────────────────────
  Decision: Uncertain auto-criteria
  Answer: Query-based, hardcoded thresholds

✻ Churned for 38s             

❯ here are our answers:   1. allow them to stack                                 
    2. let's add more flexibility - so we could apply a level discount       
  separately for group / individual - becase most likely individual lessons      
  won't have the same discounts                                                
    3. different discounts most likely - for example amount paid out in cash     
   to referrer and the referee get a percentage based discount - or some       
  different config                                                           
    4. must have - could we have this addition not affect our ui? for        
  example we would still keep the same list of students in reception meaning 
   they're created as a standalone student entity - if we then encounter a   
  family we would create a family entity at that moment - linking the newly  
  added and the existing student to the family?                              
    5. yes                                                                   

⏺ Good, clear decisions. Let me address each:

  #1 Stacking — Got it. Stack additively, enforce the 25% cap as a hard ceiling. 
  If a student has a 10% referral + 15% seasonal, they get 25% (the cap), not
  30%. Simple rule, no ambiguity.                                                
                                                                               
  #2 Scoping — So a promotion can target a specific (level, groupType)
  combination. A "20% off beginner group classes" doesn't apply to beginner
  individual lessons. This means the scope needs both fields independently: level
   Level? + groupType GroupType?, where null = all. A promotion with
  level=BEGINNER, groupType=GROUP only applies to beginner group students.

  #3 Referral — Makes sense. The referrer and referee need separate discount
  configurations. Instead of one promotion with one discount, we need something
  like:
  - referrerDiscountType (PERCENTAGE / FIXED_AMOUNT / NONE)
  - referrerDiscountValue
  - referreeDiscountType (PERCENTAGE / FIXED_AMOUNT / NONE)
  - referreeDiscountValue

  Or simpler: a referral program creates two StudentPromotion records — one for
  each party — each pointing to a different Promotion record. That way a referral
   is really a pair of promotions linked together. This keeps the Promotion model
   clean (one discount type/value per record) and avoids dual fields.

  #4 Family — Yes, exactly. Students are always standalone entities. Family is a
  grouping layer on top, created when needed:

  Family
    - id
    - name? (optional label like "Lee family")
    - createdAt

  FamilyMember
    - familyId
    - studentId (unique — a student belongs to at most one family)
    - relationship? ("sibling", "parent-child", etc.)

  Reception stays unchanged — students are listed individually. When the admin
  notices two students share a parent, they create a family and link both. The
  sibling discount promotion is then auto-applied based on family membership. No
  UI changes to reception, no change to student creation flow.

  #5 — Promotions seeded in DB for now, admin CRUD later.

  ---
  One follow-up question before I finalize the schema:

  Referral tracking — when a referral happens, how does the admin know? Two
  options:

  - A) Manual — admin creates the referral link in the system (or just notes
  "student X referred student Y"), and the system creates the two promotions.
  Fits your current workflow where everything is admin-driven.
  - B) Referral codes — each student gets a unique referral code. When a new
  student enters via amoCRM, the referral code is captured as a field. System
  auto-creates the paired promotions.

  A is simpler and matches your "admin does everything manually" pattern at
  launch. B is the eventual goal but requires amoCRM integration for the referral
   code field. I'd model for B (referral code field on Student, referrer link on
  StudentPromotion) but implement A's workflow for now. Sound right?

❯ 1. let's not enforce the 25% cap; 2. where null = all - why? wouldn't it       
  be better to have something like an array of group types? to future proof     
  for grouplesson60mins, indlesson60mins?; 4. hm why do we need the              
  FamilyMember entity? are we also creating parents in our current design?       
  each student having a referral code architecture makes sense to me -           
  student could potentially accumulate let's say 10 referrals each giving        
  him some amount of credit or actual cash. the #3 Referral flow is not          
  clear to me let's discuss more                                                 
                                                                                 
⏺ Good pushback on all points. Let me address each:                              
                                                                                 
  #1 — Simple. No cap, promotions stack additively. If a student has 10% + 15% + 
  20% = 45% off, so be it. Admin is responsible for managing what promotions are
  active.                                                                        
                                                                                 
  #2 — You're right. An array is strictly better:

  - levels Level[] — empty = applies to all levels. [BEGINNER, ELEMENTARY] = only
   those two.
  - groupTypes GroupType[] — empty = all. [GROUP] = group only.

  This also fixes the problem of needing two separate promotions for "Beginner
  and Elementary." And if GroupType expands later, it just works.

  #4 Family — You're right, FamilyMember is unnecessary. We don't have parent
  entities. The simplest model:

  Family
    id
    name?        // "Lee family" — optional label
    createdAt

  Student
    ...
    familyId String?   // nullable FK to Family

  That's it. Admin notices two students share a parent → creates a Family → sets
  familyId on both students. No junction table, no parent entity, no change to
  reception flow.

  ---
  #3 Referrals — Let's Talk Through This

  Here's why it's tricky: referrals don't fit cleanly into the Promotion model
  because the two sides get fundamentally different things.

  The scenario:
  - Student A refers Student B
  - Student A (referrer) gets cash — literally handed money, or credited toward
  next payment
  - Student B (referee) gets 10% off first month
  - Student A refers 10 friends over time → accumulates rewards

  The problem with shoehorning into Promotion:
  A "Promotion" is a discount applied to a billing period. But the referrer's
  reward might be cash, not a discount. And it accumulates per referral — it's
  not "one promotion, one discount," it's "each referral = one more reward."

  What I think the model should look like:

  Separate referrals from promotions entirely:

  Referral
    id
    referrerStudentId     // Student A
    referredStudentId     // Student B
    status                // PENDING (B hasn't paid yet), COMPLETED (B paid,
  rewards active), EXPIRED
    createdAt

    // Referrer reward config (per referral)
    referrerRewardType    // CASH, CREDIT, DISCOUNT
    referrerRewardValue   // e.g., 50000 UZS or 10%
    referrerRewardPaid    // Boolean — has the admin paid out/applied this?

    // Referee reward config
    refereeRewardType     // PERCENTAGE, FIXED_AMOUNT, NONE
    refereeRewardValue    // e.g., 10
    refereeRewardApplied  // Boolean — has this been applied to their first
  period?

  And the referral program configuration (what rewards are given) could either
  be:
  - A) Hardcoded/seeded — "right now our referral program gives referrers 50k UZS
   cash and referees 10% off." Admin changes the program by asking a dev. Simple.
  - B) A ReferralProgram model — stores the current reward configuration. Admin
  can create new programs (e.g., "Summer referral: double rewards"). Each
  Referral record links to the program that was active when the referral
  happened.

  B is more correct because the rewards could change over time, and you need to
  know "this referral was made under the old program that gave 50k, not the new
  one that gives 30k."

  Then the flow is:

  1. Every student gets a referralCode on their profile (auto-generated)
  2. New student arrives via amoCRM (or admin manually notes it) with a referral
  code
  3. Admin creates the referral in the system → Referral record created with
  status: PENDING
  4. New student makes first payment → status: COMPLETED → referee discount
  auto-applies to their first StudentPaymentPeriod, referrer reward becomes
  payable
  5. Admin sees referrer rewards to pay out in a simple list view (later scope)

  Questions for you:

  1. Does the referrer reward need to be tracked as a formal balance in the
  system (like "Student A has 150k UZS accumulated credit"), or is it enough to
  track individual referral payouts (referral 1: 50k paid, referral 2: 50k
  unpaid, referral 3: 50k unpaid)?
  2. When does the referral "activate" — when the referred student is assigned to
   a group, or when they make their first payment? I'd say first payment, since
  that's when real revenue comes in.
  3. Should the referral program config be a separate model (option B above), or
  is seeding it in code fine for now?

✻ Cogitated for 1m 4s

❯ Admin notices two students share a parent → creates a Family → sets            
    familyId on both students. No junction table, no parent entity, no       
  change to reception flow. - doesn't it mean we would have duplicate parent     
   fields on both students? student A is created with parent name/phone         
  number - then student B is also created with those fields separately?          
  desync is possible - double entry; let's first tackle everything but the       
  promotions/referrals and get back to it later                                  
                                                                                 
⏺ You're right — if two siblings both store parentPhone: "998971234567" and      
  parentName: "Mrs. Lee" independently, you have duplicate data that can desync.
  One gets updated, the other doesn't.                                           
   
  The fix is straightforward: move parent info to the Family entity.             
                  
  Family
    id
    name?            // "Lee family" — optional label
    parentFirstName  String?
    parentLastName   String?
    parentPhone      String?
    createdAt

  Student
    ...
    familyId  String?   // nullable FK to Family
    phone     String    // student's OWN phone (could be same as parent for young
   kids)

  When a student is standalone (no family), their phone field is the contact
  number (could be the parent's). When the admin creates a Family, the parent
  info moves to the Family record and both students point to it. Single source of
   truth, no duplication.

  ---
  OK, let's set promotions/referrals aside and finalize everything else. Let me
  put the full schema together. Here's what I'm implementing:
  Change: DayPattern enum → days Int[]
  Detail: 1=Mon through 7=Sun
  ────────────────────────────────────────
  Change: TimeSlot enum → startTime String
  Detail: "07:00", "14:00", etc.
  ────────────────────────────────────────
  Change: durationMinutes Int
  Detail: On Group and IndividualLesson, default 80
  ────────────────────────────────────────
  Change: Transfer/Lost reasons
  Detail: Reference tables (TransferReason, LostReason) with other free-text
  ────────────────────────────────────────
  Change: lessonsCompleted Int?
  Detail: On GroupMembership
  ────────────────────────────────────────
  Change: isTrialStudent Boolean
  Detail: On Student
  ────────────────────────────────────────
  Change: pricePerLesson Decimal
  Detail: On Group and IndividualLesson
  ────────────────────────────────────────
  Change: Family model
  Detail: Parent info on Family, familyId FK on Student
  ────────────────────────────────────────
  Change: Uncertain auto-criteria
  Detail: Query-based, no schema change (threshold hardcoded in app)
  ────────────────────────────────────────
  Change: Teacher availability
  Detail: Per day-of-week + time range
  Should I go ahead and draft the updated schema?

❯ we also have to keep in mind that some students have the parent fields         
  some don't. for example a 14 yo student would have parent contact info. a     
  30 yo adult wouldn't - how do we resolve that as well?                         
                                                                                 
⏺ Good catch. The Family entity can actually solve both problems at once:        
                  
  Family = "this student has a parent/guardian", not just "these students are    
  siblings."     
                                                                                 
  - 14-year-old solo student → Family created with parent info, student linked.  
  Family has 1 student.
  - Two siblings, 12 and 15 → same Family, parent info stored once. Family has 2
  students.
  - 30-year-old adult → no Family (familyId = null). They're their own contact.

  Family
    id
    parentFirstName  String
    parentLastName   String?
    parentPhone      String      // primary contact for all kids in this family
    createdAt

  Student
    ...
    familyId  String?    // null for adults
    phone     String?    // student's OWN phone (null for young kids who don't
  have one)

  Contact resolution is simple: family?.parentPhone ?? student.phone. For the No
  Payment List, SMS reminders, etc., the query joins on Family when it exists.
  For adults, it's just student.phone.

  This means:
  - Parent info lives in exactly one place — no duplication, no desync
  - Young kids don't need a phone number of their own
  - Adults don't carry empty parent fields
  - Siblings share one parent record naturally
  - Reception still creates students as standalone — familyId is set later when
  the admin links them

  One nuance: Student.phone should probably be required for adults and nullable
  for kids. We can enforce this at the application layer (Zod validation: if no
  familyId, phone is required) rather than the DB layer, since Prisma can't
  express conditional nullability.

  Does this work for you?

✻ Sautéed for 42s

❯ awesome but you've mentioned "Reception still creates students as              
  standalone                                                                    
    — familyId is set later when the admin links them" - i think we should       
  instead on creation of 14 yo student require parent's info and create both     
   student and family entities at the same time. for 30 yo simply create the     
   student entity. second/third/etc sibling would stem from the existing       
  sibling in the system. for all students the phone number should be             
  required - because our app will be a telegram mini app that requires           
  telegram account - the account requires a phone number(we will send an         
  invite to the app via the telegram)                                            
                                                                                 
⏺ Perfect, that's much cleaner. Let me confirm the flow:                         

  Creating a young student (e.g., 14 y/o):                                       
  1. Admin fills in student info + parent info (required)
  2. System creates Family + Student in one transaction                          
  3. student.familyId is set immediately

  Creating a sibling:
  1. Admin creates new student, searches/selects existing Family (by parent
  name/phone)
  2. New student is linked to the same Family
  3. Parent info is already there — no re-entry

  Creating an adult (e.g., 30 y/o):
  1. Admin fills in student info only, no parent section
  2. familyId = null

  Phone number: Required on all students — it's their Telegram-linked phone, used
   for sending the Mini App invite. Parent phone on Family is a separate field
  for a different purpose (billing contact, payment reminders).

  So the model is:

  Family
    parentFirstName  String
    parentLastName   String?
    parentPhone      String     // billing/contact for minors

  Student
    phone     String            // always required — student's own
  Telegram-linked phone
    familyId  String?           // null for adults, set on creation for minors

  The age threshold (when to require parent info) — is this a hard cutoff the
  admin selects, or just the admin's judgment? I'd keep it as the admin's
  decision (they choose whether to fill in parent info or not) rather than
  enforcing an age-based rule in the system. We don't even store date of birth
  currently. Agree?

❯ agree. awesome i like "  1. Admin creates new student, searches/selects        
  existing Family (by parent                                                 
    name/phone)" by we would probably also need search by the sibling phone      
  or no? i thought usually an older brother brings a younger one and it          
  would be simpler for him to recall his phone number than mom's?