# Project Guide

## What This Project Is

Online English education platform targeting Uzbekistan. Three apps + a Telegram bot:

- **Admin panel** (Next.js web app) — current implementation focus
- **Teacher app** (Next.js web app) — future
- **Student app** (Telegram Mini App) — future
- **Telegram bot** (notifications) — future

## Current Focus

**Admin panel only.** All implementation work right now is scoped to the admin panel.

## File Navigation

### Planning & Requirements

| File | Contains | Use When |
|------|----------|----------|
| `master-product-plan.md` | Master product plan — all three apps, business context, content structure, architectural constraints | Understanding overall product scope, data model requirements, or how apps relate to each other |
| `admin-panel-plan.md` | Detailed admin panel spec — tabs, tables, fields, workflows, billing model | Implementing any admin panel feature. This is the primary requirements doc. |
| `ISSUES.md` | Known pain points from current operations | Prioritizing what to solve first |
| `packages/database/DATA_MODEL.md` | Human-readable data model reference — entity relationships, field purposes, constraints, lifecycle flows, business rules | Understanding how entities relate, what constraints exist, and edge cases. **Read this before making data model or query decisions.** |

### Tech Decisions

| File | Contains | Relevant To Admin Panel? |
|------|----------|--------------------------|
| `tech/implementation.md` | Tech stack, monorepo structure, architecture decisions, deployment strategy | **Yes** — core stack decisions (Next.js, Prisma, shadcn/ui, Zod, Vercel, Neon), auth strategy, notification channels, amoCRM integration approach. |
| `tech/database-first-validation-guide.md` | Patterns for form validation aligned with DB schema — required vs nullable vs clearable fields, Zod helpers, PATCH semantics | **Yes** — follow these patterns for all admin panel forms. |
| `tech/hosting.md` | Hosting comparison, latency analysis, cost projections, data residency laws | **Yes** — for deployment decisions. Key takeaway: Vercel Dubai + Neon Frankfurt + Cloudflare CDN. |
| `tech/telegram-mini-apps.md` | TMA technical research — Bot API, sharing, payments, viewport, auth | **No** — only relevant to the student app (Telegram Mini App). |
| `tech/tma-technical-research.md` | Deep TMA research — initData, WebView behavior, cookie/session issues, limitations | **No** — only relevant to the student app (Telegram Mini App). |

### Ignore

- `research/` folder — background research, not implementation-relevant. Includes `operations-playbook.md` (research about how other learning centers operate — NOT our business rules, do not use as source of truth for business decisions or operations).
- `exercise-types-ui-guide.md` — student app exercise UI specs, not relevant to admin panel
- `learning-science-implementation.md` — learning science features for student app, not relevant to admin panel

## Tech Stack (Admin Panel)

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **ORM:** Prisma (shared schema in `packages/database`)
- **DB:** Neon PostgreSQL (Frankfurt, serverless)
- **UI:** shadcn/ui (TanStack Table for data tables)
- **Validation:** Zod (follow patterns in `tech/database-first-validation-guide.md`)
- **Auth:** Telegram Login Widget + role check in DB
- **Hosting:** Vercel (Dubai `dxb1` region)
- **CDN:** Cloudflare (free tier, Tashkent PoP)
- **Monorepo:** Turborepo

## Working Conventions

- **Use Context7 MCP** to pull latest documentation for any library (Prisma, Next.js, shadcn/ui, etc.) before making implementation decisions. Always resolve the library ID first, then query docs.

- **Data fetching architecture:**
  - `src/lib/queries/*.ts` — Read-only database operations. NO `'use server'` directive. Called directly from Server Components (same process, no overhead).
  - `src/lib/actions/*.ts` — Mutations only. MUST have `'use server'` directive. Called from Client Components. Server Actions are queued sequentially — never use them for reads.

- **Server Action auth:** Every server action that mutates data must call `requireAdmin()` or `requireRole()` at the top. Middleware and layout protect page views, but server actions are independently callable and need their own auth check.

- **Server Action error handling:** Return validation errors and known business errors (duplicate phone, group full) as `{ error }` so forms can show inline messages. Don't try/catch unexpected errors — let them throw so Next.js `error.tsx` boundaries handle them. If you catch a specific error (e.g. Prisma P2002), re-throw anything you don't recognize.

- **Validation:** All type coercion (string→number, empty→null) happens in Zod schemas (`src/schemas/`), never in react-hook-form or Server Actions. Use helpers from `src/schemas/helpers.ts` (e.g. `requiredString()`, `nullableId()`, `requiredTime()`) — they handle DB column semantics (NULL vs NOT NULL, empty→null transforms). Read `tech/database-first-validation-guide.md` for the decision flowchart on which helper to use for each column type.

## Key Domain Concepts

- **CRM Code**: unique student identifier (plain sequence number, e.g., "1", "42"), used across all views
- **Day patterns**: 1,3,5 (Mon/Wed/Fri) or 2,4,6 (Tue/Thu/Sat) — all scheduling is built on this
- **Time slots**: flexible — stored as strings (e.g., "14:00"), not a fixed enum
- **Lesson duration**: 80 minutes default, can be 60 — stored per group
- **Unified Group model**: both group lessons (up to 6 students) and individual lessons use the same `Group` entity with a `type` field (GROUP or INDIVIDUAL). Individual lessons are typically 1 student but could be 2 (not yet decided) — `maxStudents` handles this.
- **Student lifecycle**: `awaiting_assignment` → `active` → `inactive`
- **Single student entity**: one record, multiple views (Reception, Group Details, No Payment List, Student Management) via status/filters — not separate tables
- **Transfers**: moving a student between groups does NOT change their lifecycle status (they stay `active`). Transfers are tracked at the group membership level (join date, leave date, reason). A student's history of which groups they've been in lives in a separate membership record, not on the student entity.
- **Teacher pay**: per student-hour (students in group × hours × rate)
- **Billing**: first month prorated, then fixed monthly (12 lessons)
- **amoCRM (Kommo)**: external CRM for lead management. Students enter our system after passing placement test via API polling.
