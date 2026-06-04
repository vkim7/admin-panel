"use server";

import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { sendTemplatedSms, sendVerificationSms } from "@eng/sms";
import { env } from "@/env.js";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { notifyTelegramOfLead } from "@/lib/telegram";

// ─── Constants ──────────────────────────────────────────────────────────────

const PIXEL_ID = "2184030425473159";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_CODES_PER_PHONE_PER_HOUR = 3;
// Within this window an existing unverified PhoneVerification row counts as a
// "resend" — the user has already cleared Turnstile once for this phone, so
// we skip re-challenging them. Window is the same hour we rate-limit on, so
// the bot-abuse ceiling is identical (3 SMS / phone / hour).
const RESEND_TURNSTILE_GRACE_MS = 60 * 60 * 1000;

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

/**
 * Issue a verified-phone token. The token carries:
 *   - verificationId — pins the token to a specific PhoneVerification row, so
 *     `submitVerifiedLead` can atomically mark it redeemed (single-use).
 *   - phone — server cross-checks against the submitted phone; a token for
 *     phone A can't be replayed for phone B.
 *   - expiresAt — wall-clock TTL.
 * Format: `verificationId|phone|expiresAt|hmac(verificationId|phone|expiresAt)`,
 * base64url-encoded.
 */
function issueVerifiedToken(verificationId: string, phone: string): string {
  const expiresAt = Date.now() + VERIFIED_TOKEN_TTL_MS;
  const payload = `${verificationId}|${phone}|${expiresAt}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}|${signature}`, "utf8").toString("base64url");
}

type VerifiedTokenPayload = {
  verificationId: string;
  phone: string;
  expiresAt: number;
};

function verifyToken(
  token: string,
  expectedPhone: string,
): VerifiedTokenPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [verificationId, tokenPhone, expiresStr, signature] = parts as [
      string,
      string,
      string,
      string,
    ];
    if (tokenPhone !== expectedPhone) return null;
    const expiresAt = Number(expiresStr);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
    const expected = sign(`${verificationId}|${tokenPhone}|${expiresStr}`);
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return { verificationId, phone: tokenPhone, expiresAt };
  } catch {
    return null;
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
  | { ok: false; error: string }
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

  // Resends skip Turnstile: the user already cleared it for this phone once.
  // The 3/phone/hour rate limit below caps abuse — a bot that solves Turnstile
  // once gets at most 3 SMS per phone per hour anyway, same as a legit user.
  const graceCutoff = new Date(Date.now() - RESEND_TURNSTILE_GRACE_MS);
  const isResend = await prisma.phoneVerification.findFirst({
    where: {
      phone,
      createdAt: { gte: graceCutoff },
    },
    select: { id: true },
  });

  if (!isResend) {
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
  }

  if (!isPhoneAllowed(phone)) {
    // Same generic copy as a bad phone — don't leak that we have an allowlist.
    return {
      ok: false,
      error: "This phone number is not eligible for the test flow yet.",
    };
  }

  // Rate limit: per-phone, 1-hour window.
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

  // Invalidate prior unverified, unexpired codes for this phone. Otherwise a
  // user who resends because the first SMS was slow, then types the
  // first-arrived code, would hit "Incorrect code" because verifyPhoneCode
  // would only check the newest row. Expiring the old rows surfaces them as
  // expired (clean "request a new code" message) instead of as wrong codes.
  await prisma.phoneVerification.updateMany({
    where: {
      phone,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { expiresAt: new Date() },
  });

  // Generate code: 6 digits, leading zeros preserved.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // Single create — no empty-hash window. The previous two-step pattern
  // (create then update) let a racing user burn the 5-attempt budget against
  // an empty codeHash before the update landed.
  await prisma.phoneVerification.create({
    data: {
      phone,
      salt,
      codeHash,
      expiresAt,
    },
    select: { id: true },
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

  // Only the newest unverified row is checked — `requestPhoneCode` expires
  // prior rows on resend, so there can be at most one active code per phone
  // at any time.
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

  const expectedHash = hashCode(code, row.salt);
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

  // Guarded update — a concurrent `requestPhoneCode` resend can push this
  // row's expiresAt into the past between our findFirst above and the update
  // below. Re-checking expiresAt in the WHERE clause (via updateMany) closes
  // that window: if the row was expired by a resend mid-flight, count===0 and
  // we surface the same "expired" message instead of issuing a token for a
  // row that's now expired.
  const verified = await prisma.phoneVerification.updateMany({
    where: {
      id: row.id,
      verifiedAt: null,
      expiresAt: { gte: new Date() },
    },
    data: { verifiedAt: new Date() },
  });
  if (verified.count === 0) {
    return { ok: false, error: "Code expired or not found. Please request a new code." };
  }

  return { ok: true, verificationToken: issueVerifiedToken(row.id, phone) };
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
  const tokenPayload = verifyToken(verificationToken, phone);
  if (!tokenPayload) {
    return { error: "Verification expired. Please verify your phone again." };
  }

  // Redemption + lead creation happen in a single transaction. If lead.create
  // throws anything other than P2002, the transaction rolls back, leaving
  // `redeemedAt` null so the user's retry can use the same token. Without
  // this, a transient DB error during lead.create would burn the verification
  // (the retry would see redeemed=true, return duplicate=true, and the user
  // would land on the success screen with no Lead row actually created).
  //
  // Three possible outcomes encoded as a discriminated union:
  //   - `already-redeemed`: token was already used (race / replay) → duplicate
  //   - `existing-lead`: a Lead with this phone already exists → duplicate
  //   - `new-lead`: redemption + create both succeeded → schedule side effects
  type TxResult =
    | { kind: "already-redeemed" }
    | { kind: "existing-lead" }
    | {
        kind: "new-lead";
        lead: { id: string; firstName: string; phone: string; language: string };
      };

  let txResult: TxResult;
  try {
    txResult = await prisma.$transaction(async (tx) => {
      // Atomically mark redeemed. The updateMany with redeemedAt IS NULL is
      // race-safe: two parallel calls compete on the row-level lock; only
      // the first sees count===1.
      const redemption = await tx.phoneVerification.updateMany({
        where: {
          id: tokenPayload.verificationId,
          phone,
          verifiedAt: { not: null },
          redeemedAt: null,
        },
        data: { redeemedAt: new Date() },
      });
      if (redemption.count === 0) {
        return { kind: "already-redeemed" };
      }

      // Dedup by phone — same semantics as submitLead. CONVERTED leads are
      // sacred (admin may have already processed and merged them).
      const existing = await tx.lead.findFirst({
        where: { phone },
        select: { id: true, status: true },
        orderBy: { createdAt: "asc" },
      });
      if (existing) {
        if (existing.status !== "CONVERTED") {
          await tx.leadActivity.create({
            data: {
              leadId: existing.id,
              type: "RESUBMITTED",
              actorAdminId: null,
            },
          });
        }
        return { kind: "existing-lead" };
      }

      const lead = await tx.lead.create({
        data: {
          firstName,
          lastName,
          phone,
          language,
          phoneVerified: true,
        },
        select: { id: true, firstName: true, phone: true, language: true },
      });
      return { kind: "new-lead", lead };
    });
  } catch (err) {
    // Belt-and-suspenders against the parallel-submit race: the findFirst
    // inside the txn closes 99% of duplicates, but two concurrent
    // transactions can both pass it (depending on isolation level). The
    // @unique constraint on Lead.phone is the final word — P2002 means
    // another transaction won the race; treat as duplicate.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { success: true, duplicate: true };
    }
    // Anything else — the transaction rolled back, so redeemedAt is still
    // null and the user can retry with the same token.
    throw err;
  }

  if (txResult.kind === "already-redeemed" || txResult.kind === "existing-lead") {
    return { success: true, duplicate: true };
  }
  const createdLead = txResult.lead;

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

  // Push a notification to the admin Telegram group so reception staff don't
  // have to poll the leads page. No-op if env vars aren't set; never throws.
  after(() =>
    notifyTelegramOfLead({
      firstName,
      lastName,
      phone,
    }),
  );

  return { success: true, duplicate: false };
}
