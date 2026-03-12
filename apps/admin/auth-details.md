# Auth Implementation Details

## Overview

Authentication uses the **Telegram Login Widget** — no passwords, no email, no invite links. Admins are pre-registered in the `AdminUser` table by their Telegram ID. When they click the widget and authorize, Telegram sends signed profile data which we verify server-side.

## How Login Works (Step by Step)

1. Admin visits `/login` — the page renders a Telegram Login Widget (JavaScript snippet from `telegram.org`)
2. Admin clicks "Log in with Telegram" — Telegram opens a popup asking to authorize
3. Admin confirms — Telegram calls our `window.onTelegramAuth(user)` callback with signed profile data:
   ```
   { id, first_name, last_name, username, photo_url, auth_date, hash }
   ```
4. Client calls `loginWithTelegram(data)` server action
5. Server validates the data:
   - **HMAC-SHA-256 verification**: `hash` is computed as `HMAC(SHA-256(bot_token), data_check_string)` — proves the data came from Telegram, not forged
   - **Freshness check**: `auth_date` must be within the last 24 hours
6. Server looks up `AdminUser` by `telegramId` — must exist and be `isActive: true`
7. Server creates a JWT session token (signed with `AUTH_SECRET`, expires in 7 days) and sets it as an `httpOnly` cookie
8. Redirect to `/schedule` (dashboard)

## How "Inviting" New Admins Works

There are no invite links or signup flows. To add a new admin:

1. Get the person's Telegram ID (they can message `@userinfobot` on Telegram to find it)
2. Create an `AdminUser` record with their `telegramId`, name, and role
3. Tell them to visit the login page and click "Log in with Telegram" — they're in

When we build the Admin Users Management screen (Phase 12), super admins will do this through the UI. Until then, admins are added via the seed script.

## Two Auth Layers

### Layer 1: Middleware (Edge Runtime)

**File:** `src/middleware.ts`
**Runs on:** Every request (except static assets)
**Runtime:** Edge — lightweight, fast, but cannot access the database

What it does:
- Reads the `admin_session` cookie
- Verifies the JWT signature and expiry using `jose`
- If valid → request proceeds
- If missing/invalid → redirect to `/login` (and delete stale cookie)

This is a **fast gate** — it only checks "is this a valid, non-expired token?" It does NOT check if the admin still exists or is still active in the database.

### Layer 2: Admin Layout (Node Runtime)

**File:** `src/app/(admin)/layout.tsx` calls `requireAdmin()` from `src/lib/auth.ts`
**Runs on:** Every admin page render
**Runtime:** Node — full access to Prisma and the database

What it does:
- Decodes the JWT to get `adminId`
- Queries `AdminUser` from the database
- Checks `isActive: true`
- If the admin doesn't exist or is deactivated → redirect to `/login`

This is the **real check** — even if someone has a valid JWT, they can't access the app if their account was deactivated.

### Why Two Layers?

Edge Runtime (where middleware runs) cannot use Prisma or any Node.js modules. So the middleware does a cheap JWT check to block obviously unauthorized requests, and the layout does the full database check. This is a standard Next.js pattern.

## File Architecture

```
src/lib/auth-edge.ts          ← Edge-compatible (JWT only, no DB)
                                 Used by: middleware.ts
                                 Exports: createSessionToken, verifySessionToken, COOKIE_NAME

src/lib/auth.ts                ← Node-only (JWT + DB + cookies)
                                 Used by: server components, server actions
                                 Exports: createSession, getSession, destroySession,
                                          getCurrentAdmin, requireAdmin, requireRole,
                                          validateTelegramAuth

src/lib/actions/auth.ts        ← Server Actions ("use server")
                                 Used by: client components (login form, logout button)
                                 Exports: loginWithTelegram, logout

src/middleware.ts               ← Edge middleware (runs on every request)
src/app/login/page.tsx          ← Login page (server component)
src/components/auth/login-form.tsx ← Telegram widget + error display (client component)
```

## Role System

Two roles: `SUPER_ADMIN` and `ADMIN`.

- `requireAdmin()` — any authenticated, active admin
- `requireRole("SUPER_ADMIN")` — throws `Forbidden` if not super admin

Used for destructive/sensitive actions (deleting records, managing other admins, etc.).

## Session Details

- **Token format:** JWT (HS256) via `jose` library
- **Payload:** `{ adminId, role }`
- **Expiry:** 7 days
- **Storage:** `httpOnly` cookie named `admin_session`
- **Cookie flags:** `httpOnly`, `secure` (production only), `sameSite: lax`, `path: /`
- **Secret:** `AUTH_SECRET` env var (falls back to dev default in development)

## Telegram Validation (HMAC-SHA-256)

Telegram signs the login data using our bot token. Verification:

1. Sort all fields (except `hash`) alphabetically
2. Join as `key=value` pairs separated by `\n` → this is the `data_check_string`
3. Compute `secret_key = SHA-256(bot_token)`
4. Compute `HMAC-SHA-256(secret_key, data_check_string)`
5. Compare with the `hash` field — must match exactly
6. Check `auth_date` is within the last 24 hours (prevents replay attacks)

## Environment Variables

| Variable | Required | Where | Purpose |
|----------|----------|-------|---------|
| `TELEGRAM_BOT_TOKEN` | Yes (prod) | Server only | HMAC validation of Telegram login data |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Yes (prod) | Client + Server | Bot username for the login widget |
| `AUTH_SECRET` | Yes (prod) | Server only | JWT signing key. Has dev default locally. |

## Local Development Setup

The Telegram Login Widget requires a real domain (not `localhost`). Use ngrok:

1. `npx ngrok http 3000` → get the `https://xxxx.ngrok-free.app` URL
2. In Telegram, message `@BotFather` → `/setdomain` → select your bot → enter just the domain (e.g., `xxxx.ngrok-free.app`)
3. Set `TELEGRAM_BOT_TOKEN` and `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` in `apps/admin/.env`
4. Access the app through the ngrok URL, not `localhost`

## Gotchas / Lessons Learned

1. **Edge vs Node split is mandatory.** Middleware runs in Edge Runtime — it cannot import Prisma. All DB access must go through `auth.ts`, not `auth-edge.ts`.

2. **`"use server"` files can only export async functions.** Exporting types (`export type { Foo }`) from a server action file causes a runtime `ReferenceError`. Import types directly from the source module instead.

3. **`redirect()` throws (never returns).** TypeScript doesn't know this, so after an `if (!x) redirect()` check, TS still thinks `x` could be null. Use `return x!` with a comment.

4. **BotFather `/setdomain` is interactive.** Send `/setdomain`, select the bot, then enter the domain. Don't try to do it in one command.
