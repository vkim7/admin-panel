# Implementation Plan

Technical decisions for the online English education platform.

---

## Architecture Overview

### Monorepo Structure

**Tool:** Turborepo

```
eng/
├── apps/
│   ├── admin/              # Next.js — Admin panel (current focus)
│   ├── teacher/            # Next.js — Teacher web app (future)
│   └── student/            # Next.js — Student Telegram Mini App (future)
│
└── packages/
    ├── database/           # Prisma schema + client
    ├── ui/                 # shadcn/ui components (shared)
    ├── validation/         # Zod schemas (shared)
    └── config/             # Shared ESLint, TypeScript configs
```

**Rationale:**
- Code sharing across 3 apps (types, UI components, database, validation)
- Independent deployment per app
- Type safety across the entire stack

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Monorepo** | Turborepo | Manages builds, shared packages |
| **Framework** | Next.js (App Router) | All 3 apps |
| **Language** | TypeScript | Full type safety |
| **ORM** | Prisma v7 | Shared schema in `packages/database` |
| **UI Components** | shadcn/ui + TanStack Table | Data tables for admin panel |
| **Validation** | Zod | Shared schemas, DB-aligned (see `tech/database-first-validation-guide.md`) |
| **Auth** | Telegram Login Widget (admin) | Role check against `AdminUser` table |
| **Hosting** | Vercel (Dubai `dxb1` region) | See `tech/hosting.md` for latency analysis |
| **Database** | Neon PostgreSQL (Frankfurt) | Serverless, scale-to-zero |
| **CDN** | Cloudflare (Free tier) | Tashkent PoP for static assets |

### Not needed for admin panel

| Technology | Why not |
|-----------|---------|
| next-intl (i18n) | Single admin user (co-founder). Add later if more staff onboarded. |
| Cloudflare R2 | No user-uploaded media. Relevant to student app later. |
| Click/Payme payments | Payments handled outside app via e-wallet. Admin only records status. |
| TMA SDK | Admin panel is a standard web app, not a Telegram Mini App. |

---

## Key Technical Decisions

### 1. Admin Panel First

**Decision:** Build the admin panel before teacher and student apps.

**Rationale:**
- Co-founder currently manages everything in spreadsheets — admin panel has immediate operational value
- Forces us to nail the data model (students, groups, teachers, payments) before building consumer-facing apps
- Teacher and student apps consume the same data — admin panel establishes the source of truth
- Simpler surface to build and iterate on (internal tool, single user, no TMA complexity)

---

### 2. Authentication: Telegram Login Widget

**Decision:** Admin panel uses Telegram Login Widget + role check in DB.

**Flow:**
1. Admin opens the web app
2. Clicks "Login with Telegram" (Telegram Login Widget)
3. Backend validates the widget response (HMAC-SHA-256)
4. Checks `AdminUser` table for matching `telegramId`
5. If found → session created. If not → access denied.

**Future apps:**

| App | Auth method |
|-----|------------|
| Admin panel | Telegram Login Widget + `AdminUser` role check |
| Teacher app | Telegram Login Widget + `Teacher.telegramId` check |
| Student TMA | `initData` validation (HMAC-SHA-256) |

---

### 3. Database Architecture

**Decision:** Single PostgreSQL instance (Neon Frankfurt), one Prisma schema shared across all apps.

**Import:** `import { prisma } from '@eng/database'`

**Schema reference:** `packages/database/prisma/schema.prisma`
**Human-readable docs:** `packages/database/DATA_MODEL.md`

**Key design decisions in the schema:**
- All money fields are `Int` (UZS has no subdivision, all amounts are whole numbers)
- Zero Decimals in the entire schema except `Promotion.discountPercent` (which stores fractional percentages)
- `price × discountPercent / 100` always produces a whole number because prices are validated as multiples of 1,000
- Polymorphic patterns (group vs individual lesson) use nullable FK pairs with CHECK constraints
- Partial unique indexes for uniqueness on nullable columns (Prisma `@@unique` doesn't work with NULLs)
- See `data_integrity_constraints.sql` for constraints Prisma can't express natively

---

### 4. Notification Channels

**Decision:** Two channels with different purposes.

| Channel | Used for | Trigger |
|---------|----------|---------|
| **SMS** | Payment reminders | Admin sends from No Payment List (single or multi-select) |
| **Telegram bot** | Lesson reminders, homework notifications | Automated, configurable timing |

**SMS** is used for payment reminders because co-founder's experience shows higher urgency/open rate for financial messages. Telegram is used for everything else.

**Bot setup:** Register via BotFather (required for TMA + notifications). No conversational commands — bot is a notification sender only. Webhook handled as a Next.js API route.

---

### 5. amoCRM (Kommo) Integration

**Decision:** API polling at launch, webhooks later.

**Flow:**
```
amoCRM: lead → contacted → placement test booked → placement test passed
        ↓ (API polling every 5-10 min)
Our DB: Student created (status: awaiting_assignment)
        → visible in: Reception + Student Management
```

**Launch:** Poll amoCRM API for leads in "Ready for Group" pipeline stage. Create student records in our DB. Deduplicate via `Student.amoCrmLeadId`.

**Later:** Webhooks for real-time sync (requires amoCRM Advanced plan). And/or in-app placement test in TMA (students enter our system earlier).

---

### 6. Lessons via Zoom

**Decision:** No in-app video. Lessons happen on Zoom (paid plan). Recording links stored in DB.

- `Group.zoomLink` / `IndividualLesson.zoomLink` — persistent Zoom meeting link per group/student
- `Lesson.recordingUrl` — teacher confirms/uploads recording link after each lesson
- Students who miss a lesson get the recording link via Telegram notification

**Rationale:**
- Zoom is proven, reliable, already familiar to teachers
- Building video infrastructure would delay launch by months
- Zoom recordings solve the "missed lesson" problem for free

---

## Deployment Strategy

### Environment Setup
```
Production:
- apps/admin     → admin.eng.uz (or similar)
- Database       → Neon PostgreSQL (Frankfurt, main branch)

Staging:
- Vercel preview deployments per PR
- Neon database branching for isolated testing
```

### CI/CD
- Admin app deploys independently via Vercel
- Shared packages are build dependencies (not deployed separately)
- Database migrations via Prisma Migrate
- Environment variables:
  - `DATABASE_URL` — Neon connection string
  - `TELEGRAM_BOT_TOKEN` — for Login Widget validation + future notifications

---

## Tech Debt to Avoid

### Do NOT overbuild:
- No complex state management (Redux, Zustand) until needed
- No microservices — monorepo + Next.js API routes
- No Redis/caching until there's a measured performance issue
- No real-time features (WebSockets) unless explicitly required
- No premature abstractions — three similar lines > one clever utility

### DO focus on:
- Type safety (TypeScript everywhere, Zod validation aligned with DB schema)
- Simple, clear code (easy for future contributors to understand)
- Data integrity (CHECK constraints, partial unique indexes, transactional writes)
- Core admin UX (schedule view, student management, payment tracking must be fast and reliable)

---

## Appendix: Why These Decisions

### Why Next.js?
- Full-stack framework (frontend + API routes / Server Actions)
- Works for all three apps (admin web app, teacher web app, student TMA)
- Large ecosystem, easy to hire for
- Vercel deployment is zero-config for Next.js

### Why Telegram Auth?
- Zero auth infrastructure (no passwords, no email verification)
- Co-founder and teachers already use Telegram daily
- 88% Telegram adoption in Uzbekistan
- Secure (HMAC validation)
- Works for both web (Login Widget) and TMA (initData)

### Why Monorepo?
- Type safety across apps (shared types via packages)
- Code reuse (UI components, validation schemas, DB client)
- Single source of truth (one database schema)
- Independent deployment (apps still separate on Vercel)

### Why Prisma?
- Type-safe database client generated from schema
- Declarative schema as single source of truth for DB structure
- Migration system for evolving the schema safely
- Works with Neon PostgreSQL out of the box
