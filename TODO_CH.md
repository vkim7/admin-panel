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


////
Triggers (how students enter reassignment)

i thought the only reason for "Graduation without continuation" would be failing the final exam, are they any other reasons you foresee?

"Send to reassignment" action — on ACTIVE student would be required to handle the mid/final exam failures? or any other cases?

i thought the returning students would fall into a Lost list? or would they go to the lost list first and then moved to reassignment?

Orphaned students - who are orphaned students? how could we end up with orphaned students? where would they come from what scenarios would create them



TODO
let's make sure all students independent of which list they're assigned to a group from - get their free trial lesson if they haven't yet unless they've maxed out their free trial attempts


<!-- TODO CH -->
Phase 15 implemented - check / commit