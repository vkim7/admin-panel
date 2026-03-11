<!-- TODO CH - IGNORE THIS COMMENT - data models designed and ready - in local -> eng (T3 app setup) -->

if teacher can't make it to the lessson (in the following order)
- substitution
- cancelled(reschedule)

# Substitution
for the date when teacher can't make it - click a substitute button to select from the list of existing teachers - probably need to track who taught each lesson?

# Reschedule - teacher can't make it this Fri - teacher should find a time slot within the program period

# Cancellation by admin in cases of holidays

# Student onboarding
Student joins before 15th - we accelerate the program to fit into 2.5 months
Student joins after 15th - we slow down the program to 3.5 months
rationale - make all groups finish at the same time

# Lesson creation strategy: Pre-generated days for the whole month

# Discuss:

### One Architectural Question to Consider

Lesson creation strategy: The schema supports lessons as individual session records with a sequential lessonNumber. But the plan doesn't specify whether lessons are:
- (a) Pre-generated in bulk (e.g., create 12 lessons for the month when billing period starts), or
- (b) Created on-the-fly when the teacher opens the attendance view

This doesn't require schema changes — both approaches work with the current model. But the choice affects how lessonNumber is assigned and how attendance tracking
flows. Worth deciding before implementing the teacher/attendance features.

### Substitution tracking

Lesson has no status (scheduled / completed / cancelled). The operations playbook describes teacher absences, cancellations, and substitute coverage
  (operations-playbook.md:73-79). Without a status field:

  - You can't distinguish a delivered lesson from a cancelled one
  - No way to track substitutions
  - Teacher pay calculations can't exclude cancelled lessons

  This may be acceptable for launch if lessons are only created after they happen (not pre-scheduled). But if you plan to pre-generate lessons for a month, you'll need
   status.

### Lesson Cancellations & Billing Adjustments

When lessons don't happen (holidays, teacher sick, teacher vacation), how do we handle billing?

**The problem:**
Students pay a fixed monthly amount based on 12 lessons. But some months might have only 10-11 actual lessons (national holidays, teacher sick days, teacher vacation). We need a clear policy for what happens to the "missing" lessons.

**Scenarios that cause cancellations:**
- National holidays (Navruz, Independence Day, etc.) — ~10/year, affects all groups on that day
- Teacher sick day — affects only that teacher's groups, short notice
- Teacher planned vacation — affects only that teacher, 2+ weeks notice
- Emergency closure — rare, affects everyone

**Options for handling the student side:**

**Option A: Adjust current month billing**
Reduce totalLessons from 12 to actual count, recalculate amountDue.
- Student pays less that month (e.g., 10 lessons instead of 12)
- Simple and fair, but creates variable monthly payments which is harder to manage

**Option B: Credit toward next month**
Keep current month at 12, reduce next month by the missed lessons.
- e.g., 2 lessons cancelled in March → April billing = 10 lessons
- Predictable current-month billing, adjustment happens later
- Gets complicated if student leaves before credit is used

**Option C: Make-up lessons**
Schedule replacement lessons on other days to still deliver 12.
- Student gets what they paid for
- Hard to find slots that work for everyone in the group
- Doesn't scale well

**Option D: Fixed price, holidays absorbed**
12-lesson price is a flat monthly rate regardless. Holidays are expected and priced in.
- Simplest — no adjustments, no tracking needed
- Less fair to students in months with multiple holidays
- Teacher sick days are a different story — should the teacher be paid for a lesson they didn't deliver?

**Teacher pay question (separate from student billing):**
- If teacher is sick and no substitute covers: should the teacher be paid for that lesson?
- If it's a national holiday: nobody teaches, nobody gets paid for that day?
- If a substitute covers: who gets paid — original teacher, substitute, or split?

**What we need to decide:**
1. Which option (A/B/C/D) for student billing when lessons are cancelled?
2. Are national holidays treated differently from teacher-specific cancellations?
3. Teacher pay: only for lessons actually delivered, or based on schedule regardless?
4. Do we need a substitute teacher system at launch, or is that later?
