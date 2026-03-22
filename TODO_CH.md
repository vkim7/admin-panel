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
