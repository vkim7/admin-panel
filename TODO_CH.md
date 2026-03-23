1. Tasks rework
2. Uploading additional documents per job
3. Week/day view replacement with google like calendar (ONLY for events calendar)
4. No way to go back when viewing a document from a mobile app
5. Make sure notifications are only sent to people within a company
6. Notification time is wrong - should always display a local time
7. Push notifications for mobile app
8. Update permissions for crew leader role

<!-- TODO -->
 loading handling in nextjs (loading.js?)

<!-- TODO -->
what ui are we missing? for example we have the admin users data models setup up but we're missing the admin users management page to invite new admin users manage existing ones

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

# Remaining Work

Everything that's left to do, in one place. Items grouped by priority/category.

---

## 1. Group Deactivation

Not yet planned — needs design for these scenarios:
- Too few students remaining → transfer or reassignment
- Students haven't passed → transfer or reassignment
- Teacher leaves → substitute → deactivate group → transfer or reassignment

## 2. Phase 13: Communication (Deferred)

Blocked on SMS vendor selection.

- [ ] SMS sending — vendor TBD, message templates, delivery tracking
- [ ] Call history — log calls with students (date, duration, notes)
- [ ] Student profile enhancement — add communication tab (SMS + call history)

## 3. Phase 18: Scenario Testing

- [ ] Happy paths — full student lifecycle: enroll → assign → pay → attend → transfer → graduate
- [ ] Billing edge cases — mid-month joins, transfers with overpayment credit, partial periods, price changes
- [ ] Scheduling conflicts — teacher unavailability, double-booking, holiday collisions, cancel+append chains
- [ ] Group lifecycle — merge with overlapping students, graduate with non-continuing students, merge then graduate
- [ ] Constraint enforcement — try to violate each of the 37 constraints, verify system blocks with clear message
- [ ] Concurrent operations — transfer while recording payment, deactivate teacher with pending resolution
- [ ] Data integrity — after each scenario, verify no orphaned billing periods, dangling slots, incorrect payment statuses

## 4. Production Hardening

- [ ] Remove dev auth bypass — delete `DEV_BYPASS_AUTH` blocks (search `TODO: remove before prod` in `src/lib/auth.ts`, `src/middleware.ts`, `apps/admin/.env`)

## 5. Uncertain List Enhancement

- [ ] Auto-criteria for uncertain flag (3+ absences, 3+ incomplete homework) — deferred until attendance tracking is mature

## 6. Future Features

- [ ] Exam List — Exam model exists, needs management UI per group
- [ ] Payment List — financial reporting: filter by year/month/teacher/group, teacher salary overview
- [ ] amoCRM integration — API polling for leads in "Ready for Group" stage → auto-create student records
- [ ] Zoom integration — auto-create meetings per group (see `tech/zoom-integration-plan.md`)
- [ ] Analytics dashboard — student counts, revenue, utilization, homework completion
- [ ] Bulk student actions — mass payment recording, mass SMS, mass transfer
- [ ] Payment gateway integration — Click, Payme (currently manual recording only)
- [ ] Teacher file uploads — contract/passport document storage (needs S3/Cloudflare R2, `TeacherDocument` model)
- [ ] Content management — deferred, teachers use physical textbooks
