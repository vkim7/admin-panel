import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import {
  COOKIE_NAME,
  SESSION_DURATION_DAYS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth-edge";

// Re-export for convenience
export { COOKIE_NAME, type SessionPayload } from "@/lib/auth-edge";

// ─── Session Management ─────────────────────────────────────────────────────

export async function createSession(adminId: string, role: string) {
  const token = await createSessionToken(adminId, role);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  // TODO: remove before prod — DEV ONLY: bypass auth during local development
  if (process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "true") {
    return { adminId: "dev", role: "SUPER_ADMIN" };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Auth Helpers ───────────────────────────────────────────────────────────

/** Get the current admin from the session. Returns null if not authenticated or admin is inactive. */
export async function getCurrentAdmin() {
  const session = await getSession();
  if (!session) return null;

  // TODO: remove before prod — DEV ONLY: return first active SUPER_ADMIN without needing a real session
  if (process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "true") {
    const admin = await prisma.adminUser.findFirst({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        lastName: true,
        username: true,
        role: true,
        isActive: true,
      },
    });
    return admin;
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: {
      id: true,
      telegramId: true,
      firstName: true,
      lastName: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  if (!admin || !admin.isActive) return null;
  return admin;
}

/** Require authentication. Redirects to /login if not authenticated. */
export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  // redirect() throws — this line only runs if admin is non-null
  return admin!;
}

/** Require a specific role. Throws if not authorized. */
export async function requireRole(role: "SUPER_ADMIN" | "ADMIN") {
  const admin = await requireAdmin();
  if (role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden: requires SUPER_ADMIN role");
  }
  return admin;
}

// ─── Telegram Login Widget Validation ───────────────────────────────────────

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Validate Telegram Login Widget data using HMAC-SHA-256. */
export async function validateTelegramAuth(
  data: TelegramAuthData,
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  const { hash, ...rest } = data;
  const dataCheckString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
    .join("\n");

  const encoder = new TextEncoder();

  // Secret key = SHA-256(bot_token)
  const secretKeyData = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(botToken),
  );
  const secretKey = await crypto.subtle.importKey(
    "raw",
    secretKeyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    secretKey,
    encoder.encode(dataCheckString),
  );

  const computedHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHash !== hash) return false;

  // Check auth_date is not too old (allow 1 day)
  const now = Math.floor(Date.now() / 1000);
  if (now - data.auth_date > 86400) return false;

  return true;
}
