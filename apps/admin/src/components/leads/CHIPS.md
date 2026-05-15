# Leads worklist chips

Each row in `/leads` and the drawer header shows one chip (or none). The chip
encodes both **urgency** (via color tier) and **what's needed next** (via the
label). Computed by `getUrgencyInfo()` in `src/lib/helpers/lead-staleness.ts`.

## Priority

Within a status, rules fire in order; the **first matching rule wins**:

`red ▸ green ▸ blue ▸ amber ▸ idle`

Higher-priority tiers eclipse lower ones. Example: a CONTACTED lead that has
both an overdue callback AND would otherwise be ready-to-convert shows the
**red callback chip**, not the green ready chip — the time-sensitive action
takes precedence.

Within the table the chips also drive the sort: NEW status above CONTACTED
above CONVERTED above LOST, then by tier rank desc within each status.

## Color tiers

| Tier | Meaning | Example chips |
|---|---|---|
| 🔴 **red** | Act now — something is overdue. | Callback overdue · Test stale · Untouched |
| 🟢 **green** | Ready to advance to next funnel stage. | Ready to convert |
| 🔵 **blue** | First-touch needed — fresh lead, no admin action yet. | New |
| 🟡 **amber** | Mid-stage drift — admin started something but hasn't finished. Don't lose this one. | Stale · Half-qualified |
| ⚪ **idle** | Informational only — no action needed right now. | Future callback · (no chip) |

## All chips

### 🔴 `Callback · HH:MM`
- **Fires when:** `nextCallbackAt` is set and is in the past.
- **What it means:** Admin scheduled a callback and the time has come (or passed). Most time-sensitive signal we have.
- **Status it applies to:** CONTACTED only.

### 🔴 `Test · LEVEL · Xh`
- **Fires when:** Test was marked sent more than 24h ago and no score has been recorded yet.
- **What it means:** Admin sent the placement test but the lead hasn't followed up (or hasn't done it). Time to nudge.
- **Status it applies to:** CONTACTED only.

### 🔴 `Untouched · Xd`
- **Fires when:** Status is NEW and the lead was created more than 24h ago.
- **What it means:** Lead came in, nobody called yet, and it's been a day. Risk of losing them entirely.
- **Status it applies to:** NEW only.

### 🟢 `Ready to convert`
- **Fires when:** The conversion gate is satisfied — all required preference fields are captured.
  - **Beginner** (`selfAssessedLevel === "COMPLETE_BEGINNER"`): `preferredDays` AND `preferredTimeSlots` captured (specific value OR "Any" flag).
  - **Continuing** (or unknown): above + `testScore` recorded.
- **What it means:** All the info needed to create a student record is present. Click Convert.
- **Status it applies to:** CONTACTED only.

### 🔵 `New`
- **Fires when:** Status is NEW and the lead was created less than 24h ago.
- **What it means:** Fresh lead — admin hasn't touched it yet but it's not aging.
- **Status it applies to:** NEW only.

### 🟡 `Stale Xd`
- **Fires when:** Status is CONTACTED and `updatedAt` is more than 3 days ago. (Any admin touch — note edit, status change, schedule capture, etc. — resets the clock.)
- **What it means:** Admin started working this lead but nothing has happened in 3+ days. Re-engage or mark Lost.
- **Status it applies to:** CONTACTED only.

### 🟡 `Half-qualified`
- **Fires when:** At least one gate field is captured (`preferredDays.length > 0`, `preferredDaysAny`, `preferredTimeSlots.length > 0`, `preferredTimeSlotsAny`, or `testScore !== null`) but the gate is not fully satisfied.
- **What it means:** Admin is mid-conversation with this lead — keep moving, don't drop it.
- **Status it applies to:** CONTACTED only.

### ⚪ `Callback · DD MMM HH:MM`
- **Fires when:** `nextCallbackAt` is set and is in the future, AND no higher-tier rule matched.
- **What it means:** Pure information — a callback is on the calendar but isn't urgent yet.
- **Status it applies to:** CONTACTED only.

### ⚪ No chip
- **Fires when:** Status is CONTACTED, no callback, no test in flight, gate not ready, not stale, no gate field captured. OR status is LOST or CONVERTED (terminal — no chip ever).
- **What it means:** Either the lead is in a terminal state (LOST/CONVERTED) or it's a CONTACTED lead with no action signals at all. The header falls back to showing the status pill.

## Implementation notes

- Source of truth: `getUrgencyInfo(lead)` in `apps/admin/src/lib/helpers/lead-staleness.ts`.
- Tier colors: `CHIP_CLASS` in `apps/admin/src/components/leads/lead-urgency-chip.tsx`.
- Header pill colors: `URGENCY_PILL` in `apps/admin/src/components/leads/lead-drawer-header.tsx` (mirrors the chip palette).
- Stale thresholds: `STALE_NEW_HOURS = 24`, `TEST_STALE_HOURS = 24`, `STALE_CONTACTED_DAYS = 3`.
