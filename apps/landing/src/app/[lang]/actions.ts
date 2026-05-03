"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/server/db";
import { env } from "@/env.js";

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
        event_source_url: opts.eventSourceUrl ?? "https://bananaschool.uz",
        ...(opts.eventId ? { event_id: opts.eventId } : {}),
        user_data: userData,
      },
    ],
    ...(env.META_TEST_EVENT_CODE
      ? { test_event_code: env.META_TEST_EVENT_CODE }
      : {}),
  };

  await fetch(
    `https://graph.facebook.com/v22.0/${PIXEL_ID}/events?access_token=${env.META_ACCESS_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
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

  const { eventId, eventSourceUrl, fbc, fbp, ...leadData } = parsed.data;

  await prisma.lead.create({ data: leadData });

  const h = await headers();
  const userAgent = h.get("user-agent");
  const clientIp =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");

  sendLeadEvent({
    firstName: leadData.firstName,
    lastName: leadData.lastName,
    phone: leadData.phone,
    eventId,
    eventSourceUrl,
    userAgent,
    clientIp,
    fbc,
    fbp,
  }).catch(() => {});

  return { success: true };
}
