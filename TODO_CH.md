<!-- TODO -->
No recording in the cloudflare

<!-- TODO -->
do zoom mettings have a ttl? like say we would set the meeting to auto-delete after 3 months?

<!-- TODO CH -->
Remaining setup needed

  You'll need to add these env vars to apps/admin/.env (and Vercel):
  ZOOM_ACCOUNT_ID=<from Zoom Server-to-Server OAuth app>
  ZOOM_CLIENT_ID=<from Zoom Server-to-Server OAuth app>
  ZOOM_CLIENT_SECRET=<from Zoom Server-to-Server OAuth app>

-------------

Right now there's no way to do it from the admin panel — the Zoom meeting is only       
  created automatically during group creation.                                            
                                                                                          
  Options:
                                                                                          
  1. Add a "Create Zoom Meeting" button on the group detail page — shown when the group is active but has no zoomJoinUrl. Calls the Zoom API on demand.
  2. Trigger it on teacher update — when a teacher gets a zoomEmail added, retroactively  
  create meetings for their active groups that have no Zoom link.                         
  3. Keep the manual approach — admin sets up the meeting in the Zoom dashboard and pastes
   the link. But we removed the manual input field.                                       
                                                                                        
  Option 1 seems cleanest — explicit, no magic. Want me to add that button?




<!-- TODO -->
Do all steps at once on teacher creation - rates - schedule - etc

<!-- TODO -->
Refunds??? according to law???

<!-- TODO -->
Automations of SMS / comms

<!-- TODO -->
what ui are we missing (something could implement based on our data models but still don't have a ui for it)? for example we have the admin users data models setup up but we're missing the admin users management page to invite new admin users manage existing ones


<!-- TODO: Undo mistaken assignment ("Send back to Reception") -->
<!--
Problem: When an admin mistakenly assigns a student to a group, there's no way to
cleanly undo it. Current options (transfer, reassignment, lost list) all run leave
billing and create audit records — wrong for an assignment that never really happened.

Desired behavior: A "Send to Reception" action on the group details page that does a
true undo — hard-deletes the records created by the assignment, restores student to
AWAITING_ASSIGNMENT status. No billing, no leave records.

Guard: Only available if zero lessons attended AND zero payments recorded against the
billing periods created by that assignment.

Records to delete:
1. GroupMembership (the one created by the mistaken assign)
2. StudentPaymentPeriod records (linked to that membership)
3. AppliedPromotion records (discounts on those periods)
4. StudentPromotion records (only if auto-created by THIS assignment: SEASONAL, FAMILY, WIN_BACK)

Status change: Student → AWAITING_ASSIGNMENT

Open question — promotion side effects:
- If the assignment auto-triggered a FAMILY promotion for a sibling, that sibling's
  promotion should also be reversed. Same for WIN_BACK clearing lostReasonId — it
  should be restored. These are rare edge cases; could be handled manually by admin
  in v1, or handled properly in a thorough version.

Additionally: canceling a pending scheduled ASSIGN action is straightforward — just
mark it CANCELLED, no records to reverse since the student hasn't been assigned yet.
-->



<!-- !!! Persistent error: -->
(node:33829) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as
aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard
libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=require'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.
(Use `node --trace-warnings ...` to show where the warning was created)
❯ src/__tests__/scenarios/scheduling.test.ts (17 tests | 1 failed) 55772ms
    ✓ creates group → lessons + schedule slots + teacher history, holidays skipped  2062ms
    ✓ C#4: rejects creating group with teacher double-booking  2139ms
    ✓ cancel lesson → CANCELLED, slot deleted, replacement at end, endDate bumped  3277ms
    ✓ cancel replacement → originalLessonId propagated from chain root (A→B→C)  4074ms
    ✓ updates startTime → future SCHEDULED lessons + slots cascade-updated  2170ms
    ✓ student cancel → replacement created, cancellationsUsed incremented  2968ms
    ✓ student cancel GROUP lesson → error  1426ms
    ✓ student cancel with <24h notice → error  1849ms
    ✓ 3rd student cancel in month → error (limit is 2)  4609ms
    ✓ reschedules lesson → dates swapped, slot moved, originalDate preserved  2476ms
    ✓ records unavailability → affected SCHEDULED lessons become PENDING_RESOLUTION  2227ms
    ✓ C#20a: overlapping unavailability on same date → error  932ms
    ✓ assigns substitute → slot swapped, lesson back to SCHEDULED  3572ms
    × changes teacher → group, future lessons, slots, history all updated 3179ms
    ✓ snapshots activeStudentCount as of lessonDate  3685ms
    ✓ student leaves between lesson and marking → snapshot uses lessonDate count  3892ms
    ✓ absent trial student → auto-removed, deactivated if solo  7870ms