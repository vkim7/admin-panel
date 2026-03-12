/**
 * Edge-compatible auth helpers. No DB access — only JWT verification.
 * Used by middleware. For DB-backed auth (getCurrentAdmin, etc.), use auth.ts.
 */
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "admin_session";
const SESSION_DURATION_DAYS = 7;

function getSecret() {
  const secret =
    process.env.AUTH_SECRET ?? "dev-secret-do-not-use-in-production";
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters in production");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  adminId: string;
  role: string;
}

export async function createSessionToken(
  adminId: string,
  role: string,
): Promise<string> {
  return new SignJWT({ adminId, role } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export { SESSION_DURATION_DAYS };
