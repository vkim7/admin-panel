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


<!-- todo -->
let's add a comment for the "## Phase 18: Promotion Auto-Detection &           
Application Rules" in our implementation plan to update the logic behind the     
First-lesson trial discount - it should only be applied to individual lessons -  
for group lessons the first lesson is free. when applying the First-lesson trial 
 discount we should charge the student independent of the outcome - whether he   
commits or not the student should be charged for the first lesson

- for group lessons - the first trial lesson is always free(100% discount - will need a separate promotion for that?)
- for individual lessons - we should charge the student independent of the outcome - whether he commits or not the student should be charged for the first lesson

- for group lessons - students have 2 attempts max to have a trial lesson. if student is no-show to his first trial lesson he's moved to the lost list with reason "trial no-show". We will then contact him to schedule his 2nd trial lesson - once scheduled he's removed from the lost list - if he's no-show again he is moved to the lost list again with reason "trial no-show twice" or better wording - student loses his free trials.

- for individual lessons - the same logic applies but student has only one attempt at free trial lesson - if "no show" - he's moved to the lost list

important: even if students lost their free trials they can still be schedule but without the free trial promotion

important: each student has a right to 2 free trials in group lessons and 1 free trial in the individual lessons