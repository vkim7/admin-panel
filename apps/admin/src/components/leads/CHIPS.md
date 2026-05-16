# Leads worklist chips

Each row in `/leads` and the drawer header shows up to **two** chips: a
**primary** chip encoding the lead's state (urgency tier + label) and an
optional **secondary** chip encoding a scheduled future callback. Computed by
`getUrgencyInfo()` in `src/lib/helpers/lead-staleness.ts`.

The dual-pill model exists because a scheduled callback is a committed
next-action and shouldn't be eclipsed by passive drift signals (Stale,
Half-qualified). Admin always sees both "what state is this lead in" and
"when's the next touch."

## Primary chip — precedence

Within a status, rules fire in order; the **first matching rule wins**:

`red ▸ green ▸ amber ▸ idle (no chip)`

Higher-priority tiers eclipse lower ones. Example: a CONTACTED lead that has
both an overdue callback AND would otherwise be ready-to-convert shows the
**red callback chip** as primary — the time-sensitive action takes precedence.

Within the table the primary chip drives the sort: NEW status above CONTACTED
above CONVERTED above LOST, then by tier rank desc within each status. The
secondary callback chip does **not** affect sort order.

## Secondary chip — future callback

Always rendered when `nextCallbackAt` is set and in the future, regardless of
which primary chip fires — **except** the overdue-callback red, where a future
callback can't coexist by definition (`nextCallbackAt` is a single field).

Visual: outlined / muted (`border-slate-300 text-slate-600 bg-transparent`) so
it reads as informational beside the louder primary chip.

NEW, LOST, and CONVERTED leads never show a secondary chip.

## Color tiers (primary)

| Tier | Meaning | Example chips |
|---|---|---|
| 🔴 **red** | Act now — something is overdue. | Callback overdue · Test stale · Untouched |
| 🟢 **green** | Ready to advance to next funnel stage. | Ready to convert |
| 🔵 **blue** | First-touch needed — fresh lead, no admin action yet. | New |
| 🟡 **amber** | Mid-stage drift — admin started something but hasn't finished. Don't lose this one. | Stale · Half-qualified |
| ⚪ **idle** | No primary chip. Secondary callback (if any) stands alone. | (no primary) |

## All chips

### 🔴 `Callback · HH:MM` (primary)
- **Fires when:** `nextCallbackAt` is set and is in the past.
- **What it means:** Admin scheduled a callback and the time has come (or passed). Most time-sensitive signal we have.
- **Status it applies to:** CONTACTED only.
- **Pairs with secondary?** No — a future callback can't coexist with an overdue one.

### 🔴 `Test · LEVEL · Xh` (primary)
- **Fires when:** Test was marked sent more than 24h ago and no score has been recorded yet.
- **What it means:** Admin sent the placement test but the lead hasn't followed up (or hasn't done it). Time to nudge.
- **Status it applies to:** CONTACTED only.
- **Pairs with secondary?** Yes — common case: admin sends test, then schedules a follow-up call.

### 🔴 `Untouched · Xd` (primary)
- **Fires when:** Status is NEW and the lead was created more than 24h ago.
- **What it means:** Lead came in, nobody called yet, and it's been a day. Risk of losing them entirely.
- **Status it applies to:** NEW only.
- **Pairs with secondary?** No — NEW leads can't have callbacks.

### 🟢 `Ready to convert` (primary)
- **Fires when:** The conversion gate is satisfied — all required preference fields are captured.
  - **Beginner** (`selfAssessedLevel === "COMPLETE_BEGINNER"`): all 5 prefs (days, time, lesson type, language, DOB).
  - **Continuing** (or unknown): above + `testScore` recorded.
- **What it means:** All the info needed to create a student record is present. Click Convert.
- **Status it applies to:** CONTACTED only.
- **Pairs with secondary?** Yes — admin may want to confirm enrollment on a call before converting.

### 🔵 `New` (primary)
- **Fires when:** Status is NEW and the lead was created less than 24h ago.
- **What it means:** Fresh lead — admin hasn't touched it yet but it's not aging.
- **Status it applies to:** NEW only.
- **Pairs with secondary?** No — NEW leads can't have callbacks.

### 🟡 `Stale Xd` (primary)
- **Fires when:** Status is CONTACTED and `updatedAt` is more than 3 days ago.
- **What it means:** Admin started working this lead but nothing has happened in 3+ days. Re-engage or mark Lost.
- **Status it applies to:** CONTACTED only.
- **Pairs with secondary?** Theoretically yes, but in practice scheduling a callback updates `updatedAt`, so the Stale clock resets and this combo doesn't form.

### 🟡 `Half-qualified` (primary)
- **Fires when:** At least one **admin-captured** gate field is set (`preferredDays`, `preferredDaysAny`, `preferredTimeSlots`, `preferredTimeSlotsAny`, `dateOfBirth`, or `testScore`) but the gate is not fully satisfied. `lessonPreference` and `preferredLanguage` are deliberately excluded — they can arrive pre-filled from the intake form, and a lead with only intake data shouldn't be flagged as half-qualified.
- **What it means:** Admin has started qualifying this lead (either saved the prefs dialog or recorded a test score) but the gate isn't fully met yet. Keep moving, don't drop it.
- **Status it applies to:** CONTACTED only.
- **Pairs with secondary?** Yes — the dual-pill design lets admin see both "we're mid-qualification" and "callback is scheduled" at once.

### ⚪ `Callback · DD MMM HH:MM` (secondary)
- **Fires when:** `nextCallbackAt` is set and is in the future.
- **What it means:** Pure information — a callback is on the calendar. Rendered as a muted secondary pill alongside whatever primary chip the lead has (or alone if the lead has no primary signal).
- **Status it applies to:** CONTACTED only.

### ⚪ No chip
- **Fires when:** Status is CONTACTED, no callback, no test in flight, gate not ready, not stale, no gate field captured. OR status is LOST or CONVERTED (terminal — no chip ever).
- **What it means:** Either the lead is in a terminal state (LOST/CONVERTED) or it's a CONTACTED lead with no action signals at all. The drawer header falls back to showing the status pill.

## Implementation notes

- Source of truth: `getUrgencyInfo(lead)` in `apps/admin/src/lib/helpers/lead-staleness.ts`. Returns `{ tier, chip, callbackChip }`.
- Tier colors: `CHIP_CLASS` in `apps/admin/src/components/leads/lead-urgency-chip.tsx`.
- Secondary pill style: `SECONDARY_CHIP_CLASS` in the same file (outlined / muted).
- Header pill colors: `URGENCY_PILL` in `apps/admin/src/components/leads/lead-drawer-header.tsx` (mirrors the chip palette).
- Stale thresholds: `STALE_NEW_HOURS = 24`, `TEST_STALE_HOURS = 24`, `STALE_CONTACTED_DAYS = 3`.
