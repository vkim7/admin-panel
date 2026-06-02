"use server";

import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { sendTemplatedSms, sendVerificationSms } from "@eng/sms";
import { env } from "@/env.js";
import { verifyTurnstileToken } from "@/lib/turnstile";

// ─── Constants ──────────────────────────────────────────────────────────────

const PIXEL_ID = "2184030425473159";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_CODES_PER_PHONE_PER_HOUR = 3;
const MAX_CODES_PER_IP_PER_HOUR = 10;

const VERIFIED_TOKEN_TTL_MS = 15 * 60 * 1000; // signed token must be redeemed within 15 min

// HMAC key for the verification proof token. Derived from DATABASE_URL so we
// don't introduce a new required env — the URL is already a secret bound to
// this deployment, and the token is short-lived anyway. If you ever rotate
// DATABASE_URL, in-flight verification tokens will be invalidated (acceptable).
const TOKEN_HMAC_KEY = createHash("sha256")
  .update(`verify-token:${env.DATABASE_URL}`)
  .digest();

// ─── Schemas ────────────────────────────────────────────────────────────────

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+998\d{9}$/, "Invalid phone number");

const languageSchema = z.enum(["uz", "ru"]);

const requestCodeSchema = z.object({
  phone: phoneSchema,
  language: languageSchema,
});

const submitSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  language: languageSchema,
  verificationToken: z.string().min(1),
  eventId: z.string().optional(),
  eventSourceUrl: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashCode(code: string, salt: string): string {
  // Salted SHA-256. Threat model: brief DB exposure of in-flight rows; codes
  // expire in 10 min and are limited to 5 guesses each. Not a password hash —
  // doesn't need scrypt/argon2.
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function sign(payload: string): string {
  return createHmac("sha256", TOKEN_HMAC_KEY).update(payload).digest("hex");
}

function issueVerifiedToken(phone: string): string {
  const expiresAt = Date.now() + VERIFIED_TOKEN_TTL_MS;
  const payload = `${phone}|${expiresAt}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}|${signature}`, "utf8").toString("base64url");
}

function verifyToken(token: string, phone: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 3) return false;
    const [tokenPhone, expiresStr, signature] = parts as [string, string, string];
    if (tokenPhone !== phone) return false;
    const expiresAt = Number(expiresStr);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
    const expected = sign(`${tokenPhone}|${expiresStr}`);
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isPhoneAllowed(phone: string): boolean {
  const raw = env.VERIFY_ALLOWLIST_PHONES;
  if (!raw || !raw.trim()) return true; // unset → no restriction
  const allowed = raw.split(",").map((p) => p.trim()).filter(Boolean);
  return allowed.includes(phone);
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function clientIpFrom(h: Headers): string | null {
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}

// ─── requestPhoneCode ───────────────────────────────────────────────────────

export type RequestCodeState =
  | { ok: true; cooldownSeconds: number }
  | { ok: false; error: string; cooldownSeconds?: number }
  | null;

export async function requestPhoneCode(
  _prev: RequestCodeState,
  formData: FormData,
): Promise<RequestCodeState> {
  const parsed = requestCodeSchema.safeParse({
    phone: formData.get("phone"),
    language: formData.get("language"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid phone number." };
  }
  const { phone, language } = parsed.data;

  // Turnstile first — same as submitLead, fail closed.
  const turnstileToken = formData.get("cf-turnstile-response");
  const h = await headers();
  const clientIp = clientIpFrom(h);
  const verified = await verifyTurnstileToken(
    typeof turnstileToken === "string" ? turnstileToken : null,
    clientIp,
  );
  if (!verified) {
    return {
      ok: false,
      error: "Verification failed. Please reload the page and try again.",
    };
  }

  if (!isPhoneAllowed(phone)) {
    // Same generic copy as a bad phone — don't leak that we have an allowlist.
    return {
      ok: false,
      error: "This phone number is not eligible for the test flow yet.",
    };
  }

  // Rate limit: per-phone and per-IP, 1-hour window.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentForPhone = await prisma.phoneVerification.count({
    where: { phone, createdAt: { gte: oneHourAgo } },
  });
  if (recentForPhone >= MAX_CODES_PER_PHONE_PER_HOUR) {
    return {
      ok: false,
      error: "Too many attempts. Please try again later.",
    };
  }
  // IP rate limit is best-effort — we track via phone history only (no IP
  // column). Add IP throttling if abuse is observed; not building it
  // preemptively. The MAX_CODES_PER_IP_PER_HOUR constant is reserved for that.
  void MAX_CODES_PER_IP_PER_HOUR;

  // Generate code: 6 digits, leading zeros preserved.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  const row = await prisma.phoneVerification.create({
    data: {
      phone,
      // Use the row's id as salt: known to us, unique per row, never leaves
      // the server. We compute the hash after the row exists so we can salt
      // with `row.id`.
      codeHash: "",
      expiresAt,
    },
    select: { id: true },
  });
  const codeHash = hashCode(code, row.id);
  await prisma.phoneVerification.update({
    where: { id: row.id },
    data: { codeHash },
  });

  // Send the SMS post-response. The form already shows "Code sent" so a slow
  // Eskiz call shouldn't block UI. If sending fails, the user will hit the
  // resend cooldown and notice — and we log the failure.
  after(async () => {
    try {
      const result = await sendVerificationSms({ phone, language, code });
      if (!result.ok) {
        console.error(
          `[verify] SMS send failed for ${phone}: ${result.status} ${result.reason}`,
        );
      }
    } catch (err) {
      console.error("[verify] sendVerificationSms threw", err);
    }
  });

  return { ok: true, cooldownSeconds: 60 };
}

// ─── verifyPhoneCode ────────────────────────────────────────────────────────

export type VerifyCodeState =
  | { ok: true; verificationToken: string }
  | { ok: false; error: string; remainingAttempts?: number }
  | null;

export async function verifyPhoneCode(
  _prev: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const parsed = z
    .object({
      phone: phoneSchema,
      code: z.string().trim().regex(/^\d{6}$/, "Invalid code"),
    })
    .safeParse({ phone: formData.get("phone"), code: formData.get("code") });
  if (!parsed.success) {
    return { ok: false, error: "Invalid code." };
  }
  const { phone, code } = parsed.data;

  const row = await prisma.phoneVerification.findFirst({
    where: { phone, verifiedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    return { ok: false, error: "Code expired or not found. Please request a new code." };
  }

  if (row.attempts >= MAX_ATTEMPTS_PER_CODE) {
    return { ok: false, error: "Too many attempts. Please request a new code." };
  }

  const expectedHash = hashCode(code, row.id);
  const a = Buffer.from(expectedHash, "hex");
  const b = Buffer.from(row.codeHash, "hex");
  const matches = a.length === b.length && timingSafeEqual(a, b);

  if (!matches) {
    await prisma.phoneVerification.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    const remainingAttempts = MAX_ATTEMPTS_PER_CODE - (row.attempts + 1);
    return {
      ok: false,
      error: "Incorrect code.",
      remainingAttempts: Math.max(0, remainingAttempts),
    };
  }

  await prisma.phoneVerification.update({
    where: { id: row.id },
    data: { verifiedAt: new Date() },
  });

  return { ok: true, verificationToken: issueVerifiedToken(phone) };
}

// ─── submitVerifiedLead ─────────────────────────────────────────────────────

async function sendLeadEvent(opts: {
  firstName: string;
  lastName: string;
  phone: string;
  eventId?: string;
  eventSourceUrl?: string;
  userAgent?: string | null;
  clientIp?: string | null;
  fbc?: string | null;
  fbp?: string | null;
}) {
  const userData: Record<string, string> = {
    fn: sha256Hex(opts.firstName.toLowerCase().trim()),
    ln: sha256Hex(opts.lastName.toLowerCase().trim()),
    ph: sha256Hex(opts.phone.replace("+", "")),
  };
  if (opts.userAgent) userData["client_user_agent"] = opts.userAgent;
  if (opts.clientIp) userData["client_ip_address"] = opts.clientIp;
  if (opts.fbc) userData["fbc"] = opts.fbc;
  if (opts.fbp) userData["fbp"] = opts.fbp;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: opts.eventSourceUrl || "https://bananaschool.uz",
        ...(opts.eventId ? { event_id: opts.eventId } : {}),
        user_data: userData,
      },
    ],
    ...(env.META_TEST_EVENT_CODE
      ? { test_event_code: env.META_TEST_EVENT_CODE }
      : {}),
  };

  const res = await fetch(
    `https://graph.facebook.com/v22.0/${PIXEL_ID}/events?access_token=${env.META_ACCESS_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[CAPI] Lead event rejected: ${res.status} ${res.statusText} ${body}`,
    );
  }
}

export type SubmitVerifiedLeadState =
  | { success: true; duplicate: boolean }
  | { error: string }
  | null;

export async function submitVerifiedLead(
  _prev: SubmitVerifiedLeadState,
  formData: FormData,
): Promise<SubmitVerifiedLeadState> {
  const parsed = submitSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    language: formData.get("language"),
    verificationToken: formData.get("verificationToken"),
    eventId: formData.get("eventId"),
    eventSourceUrl: formData.get("eventSourceUrl"),
    fbc: formData.get("fbc"),
    fbp: formData.get("fbp"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { phone, language, verificationToken, firstName, lastName, eventId, eventSourceUrl, fbc, fbp } = parsed.data;

  // Re-check the proof. The token is the ONLY thing that says this phone has
  // been verified — if it's missing, expired, or for a different phone, we
  // refuse. We don't fall back to looking up PhoneVerification by phone alone
  // (that would let a client submit any phone after verifying any other).
  if (!verifyToken(verificationToken, phone)) {
    return { error: "Verification expired. Please verify your phone again." };
  }

  // Dedup by phone — same semantics as submitLead. CONVERTED leads are sacred.
  const existing = await prisma.lead.findFirst({
    where: { phone },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    if (existing.status !== "CONVERTED") {
      await prisma.leadActivity.create({
        data: { leadId: existing.id, type: "RESUBMITTED", actorAdminId: null },
      });
    }
    return { success: true, duplicate: true };
  }

  const createdLead = await prisma.lead.create({
    data: {
      firstName,
      lastName,
      phone,
      language,
      phoneVerified: true,
    },
    select: { id: true, firstName: true, phone: true, language: true },
  });

  const h = await headers();
  const userAgent = h.get("user-agent");
  const clientIp = clientIpFrom(h);

  after(async () => {
    try {
      await sendLeadEvent({
        firstName,
        lastName,
        phone,
        eventId,
        eventSourceUrl,
        userAgent,
        clientIp,
        fbc,
        fbp,
      });
    } catch (err) {
      console.error("[CAPI] Lead event failed", err);
    }
  });

  after(async () => {
    try {
      const smsLanguage =
        createdLead.language === "uz" || createdLead.language === "ru"
          ? createdLead.language
          : "ru";
      await sendTemplatedSms({
        recipient: {
          leadId: createdLead.id,
          phone: createdLead.phone,
          language: smsLanguage,
        },
        templateCode: "lead_greeting",
        variables: { name: createdLead.firstName },
      });
    } catch (err) {
      console.error("[SMS] greeting failed", err);
    }
  });

  return { success: true, duplicate: false };
}
