import { prisma } from "@eng/database";
import * as client from "./client";

/**
 * Token caching for Eskiz JWTs.
 *
 * Eskiz JWTs live 30 days. Without caching, every Vercel cold start would
 * re-login. The EskizToken singleton row in our DB persists the token across
 * cold starts; refresh at the 25-day mark for safety.
 *
 * Concurrency: two cold starts could race to refresh. We use a Prisma
 * transaction with a SELECT-style read inside it so the second concurrent
 * caller sees the first's fresh write rather than re-refreshing.
 */

const SINGLETON_ID = "default";
/** Refresh when the current token has fewer than this many milliseconds left. */
const REFRESH_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
/** How long an Eskiz JWT lives (per their docs). */
const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface EskizCredentials {
  email: string;
  password: string;
}

/**
 * Return a valid Eskiz JWT, refreshing or logging in as needed.
 *
 * Reads/writes the EskizToken singleton row. Safe to call on every send;
 * the cache check is a single indexed lookup.
 */
export async function getActiveToken(creds: EskizCredentials): Promise<string> {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.eskizToken.findUnique({
      where: { id: SINGLETON_ID },
    });

    const now = Date.now();
    if (existing && existing.expiresAt.getTime() - now > REFRESH_THRESHOLD_MS) {
      // Plenty of life left — use as-is.
      return existing.token;
    }

    // Either no token cached yet, or current one is nearing expiry. Refresh
    // if we have something to refresh from; otherwise full login.
    let next: { token: string };
    if (existing) {
      try {
        next = await client.refresh(existing.token);
      } catch {
        // Refresh failed (token might already be expired or revoked) — fall
        // back to a full login. The credentials are the source of truth.
        next = await client.login(creds);
      }
    } else {
      next = await client.login(creds);
    }

    const expiresAt = new Date(now + TOKEN_LIFETIME_MS);

    await tx.eskizToken.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        token: next.token,
        expiresAt,
      },
      update: {
        token: next.token,
        expiresAt,
        refreshedAt: new Date(now),
      },
    });

    return next.token;
  });
}

/**
 * Read credentials from environment. Throws if either is missing — callers
 * should let this surface as a 500 (it's a deployment misconfiguration).
 */
export function credentialsFromEnv(): EskizCredentials {
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "ESKIZ_EMAIL and ESKIZ_PASSWORD must be set in the environment",
    );
  }
  return { email, password };
}
