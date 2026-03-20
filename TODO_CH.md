<!-- TODO -->
deactivate group functionality planned?

1. too few students 
- less than minimum number of students left - either transfer or reassignment list
  - students haven't passed - either transfer or reassignment list
1. teacher leaves -> substitute -> deactivate - either transfer or reassignment list


<!-- TODO -->

"First-lesson trial discount — auto-applied when a trial commits via a seeded TRIAL promotion" - what happens if student doesn't commit?

Trial discount if student doesn't commit — Nothing happens. The TRIAL StudentPromotion is only created inside resolveTrialMembership() when action === "commit".
If the student is removed (action === "remove"), no promotion is created and no billing periods exist. No discount is ever applied.


update the seed data
1. set price per group lesson for students - at 100000 per lesson
2. set price per individual lesson for students - at 200000 per lesson
