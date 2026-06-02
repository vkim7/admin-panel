"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { sendTemplatedSms } from "@eng/sms";
import { env } from "@/env.js";
import { verifyTurnstileToken } from "@/lib/turnstile";

const PIXEL_ID = "2184030425473159";

const leadSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+998\d{9}$/, "Invalid phone number"),
  dateOfBirth: z.preprocess(
    (val) =>
      typeof val === "string" && val.trim() !== "" ? new Date(val) : null,
    z.date().nullable(),
  ),
  lessonPreference: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.enum(["GROUP", "INDIVIDUAL"]).nullable(),
  ),
  selfAssessedLevel: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.enum(["COMPLETE_BEGINNER", "CONTINUING"]).nullable(),
  ),
  note: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.string().max(500).nullable(),
  ),
  language: z.enum(["uz", "ru"]),
  eventId: z.string().optional(),
  eventSourceUrl: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
});

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

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
    fn: sha256(opts.firstName.toLowerCase().trim()),
    ln: sha256(opts.lastName.toLowerCase().trim()),
    ph: sha256(opts.phone.replace("+", "")),
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

export async function submitLead(
  _prev: { success?: boolean; error?: string } | null,
  formData: FormData,
) {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    dateOfBirth: formData.get("dateOfBirth"),
    lessonPreference: formData.get("lessonPreference"),
    selfAssessedLevel: formData.get("selfAssessedLevel"),
    note: formData.get("note"),
    language: formData.get("language"),
    eventId: formData.get("eventId"),
    eventSourceUrl: formData.get("eventSourceUrl"),
    fbc: formData.get("fbc"),
    fbp: formData.get("fbp"),
  };

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  // Bot check — runs before dedup/CAPI/SMS so failed verifications cost us
  // nothing (no DB write, no third-party fan-out). Generic error so we don't
  // give automated scripts a clean signal that they were detected.
  const turnstileToken = formData.get("cf-turnstile-response");
  const h = await headers();
  // CF-Connecting-IP is set by Cloudflare itself and isn't spoofable upstream;
  // prefer it over x-forwarded-for when present.
  const clientIp =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip");
  const verified = await verifyTurnstileToken(
    typeof turnstileToken === "string" ? turnstileToken : null,
    clientIp,
  );
  if (!verified) {
    return { error: "Verification failed. Please reload the page and try again." };
  }

  const { eventId, eventSourceUrl, fbc, fbp, ...leadData } = parsed.data;

  // Dedup by phone. A returning visitor sees the same kind of green success
  // screen (with copy that hints "we already have you"), but we don't create
  // a second Lead row and we don't fire the greeting SMS or Meta CAPI ping
  // again. CONVERTED leads are sacred — never touch them, just acknowledge.
  // For everything else we record a RESUBMITTED activity so admins see the
  // engagement signal in the drawer.
  const existing = await prisma.lead.findFirst({
    where: { phone: leadData.phone },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    if (existing.status !== "CONVERTED") {
      await prisma.leadActivity.create({
        data: {
          leadId: existing.id,
          type: "RESUBMITTED",
          actorAdminId: null,
        },
      });
    }
    return { success: true, duplicate: true };
  }

  // Belt-and-suspenders against the parallel-submit race: the findFirst above
  // closes 99% of duplicates, but two concurrent calls can both pass it.
  // Lead.phone is @unique at the DB level — Prisma raises P2002 on the second
  // insert, which we translate back to the same duplicate response.
  let createdLead: { id: string; firstName: string; phone: string; language: string };
  try {
    createdLead = await prisma.lead.create({
      data: leadData,
      select: { id: true, firstName: true, phone: true, language: true },
    });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { success: true, duplicate: true };
    }
    throw err;
  }

  const userAgent = h.get("user-agent");

  after(async () => {
    try {
      await sendLeadEvent({
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        phone: leadData.phone,
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

  // Greeting SMS — fires post-response so a slow Eskiz call never makes the
  // form feel laggy. Failures are logged but never bubble to the user (the
  // lead row was already committed; the form should still report success).
  // The @eng/sms funnel writes a SmsHistory row regardless of outcome,
  // so even a failed greeting is visible later in the admin lead drawer.
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
