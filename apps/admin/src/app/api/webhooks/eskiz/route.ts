import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * Eskiz SMS delivery callback handler.
 *
 * Eskiz POSTs delivery state changes to the URL configured via the
 * `callback_url` field on each /api/message/sms/send request. We append a
 * shared secret as a query string (?secret=...) and validate it here —
 * Eskiz doesn't sign callbacks, so the secret is the only auth.
 *
 * Payload shape (per eskiz.md):
 *   {
 *     "request_id": "UUID",       // matches SmsHistory.eskizRequestId
 *     "message_id": "4385062",    // Eskiz internal SMS ID (numeric string)
 *     "user_sms_id": "...",       // our SmsHistory.id (we set this on send)
 *     "country": "UZ",
 *     "phone_number": "998991234567",
 *     "sms_count": "1",
 *     "status": "DELIVRD",        // per-part Eskiz status (see below)
 *     "status_date": "2021-04-02 00:39:36"
 *   }
 *
 * Idempotency: Eskiz may retry callbacks. We use last-write-wins on the
 * row's status — if a later callback arrives for the same row, the row
 * is just updated again. The eskizMessageId stays stable across retries.
 */

// Eskiz per-part statuses → our SmsStatus
//   Terminal-delivered: DELIVRD
//   Terminal-failed:    REJECTD, UNDELIV, UNDELIVERABLE, EXPIRED, DELETED
//   Intermediate (row stays SENT): NEW, ACCEPTED, ENROUTE, UNKNOWN
// We also accept the overall-message statuses for safety:
//   DELIVERED, PARTDELIVERED → DELIVERED
//   REJECTED → FAILED
function mapEskizStatus(
  raw: string,
): { status: "DELIVERED" | "FAILED"; reason?: string } | null {
  const s = raw.toUpperCase();
  if (s === "DELIVRD" || s === "DELIVERED" || s === "PARTDELIVERED") {
    return { status: "DELIVERED" };
  }
  if (
    s === "REJECTD" ||
    s === "REJECTED" ||
    s === "UNDELIV" ||
    s === "UNDELIVERABLE" ||
    s === "EXPIRED" ||
    s === "DELETED"
  ) {
    return { status: "FAILED", reason: raw };
  }
  // NEW / ACCEPTED / ENROUTE / STORED / UNKNOWN — intermediate, no DB write
  return null;
}

function parseStatusDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  // Eskiz format: "2021-04-02 00:39:36" (Tashkent local time, no TZ marker).
  // ISO-fy it and treat as UTC — close enough for our timeline display.
  const iso = raw.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

interface EskizPayload {
  request_id?: string;
  message_id?: string;
  user_sms_id?: string;
  status?: string;
  status_date?: string;
  phone_number?: string;
}

async function parseBody(request: Request): Promise<EskizPayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as EskizPayload;
  }
  // Default to form-data / urlencoded — both work with FormData.
  const form = await request.formData();
  return {
    request_id: form.get("request_id")?.toString(),
    message_id: form.get("message_id")?.toString(),
    user_sms_id: form.get("user_sms_id")?.toString(),
    status: form.get("status")?.toString(),
    status_date: form.get("status_date")?.toString(),
    phone_number: form.get("phone_number")?.toString(),
  };
}

export async function POST(request: Request) {
  // ─── Auth: shared secret in query string ───
  const url = new URL(request.url);
  const providedSecret = url.searchParams.get("secret");
  const expectedSecret = process.env.ESKIZ_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error(
      "[Eskiz Webhook] ESKIZ_WEBHOOK_SECRET not configured — rejecting all callbacks",
    );
    return NextResponse.json({ error: "Misconfigured" }, { status: 503 });
  }
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── Parse and validate payload ───
  let payload: EskizPayload;
  try {
    payload = await parseBody(request);
  } catch (err) {
    console.error("[Eskiz Webhook] Failed to parse body:", err);
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  if (!payload.status) {
    // Some intermediate callbacks may omit status — accept gracefully.
    return NextResponse.json({ status: "no_status" });
  }

  // ─── Locate the SmsHistory row ───
  // Try eskizRequestId (UUID) first, fall back to row id (we passed it as
  // user_sms_id on the original send). Either correlation key works.
  const row = await prisma.smsHistory.findFirst({
    where: {
      OR: [
        ...(payload.request_id
          ? [{ eskizRequestId: payload.request_id }]
          : []),
        ...(payload.user_sms_id ? [{ id: payload.user_sms_id }] : []),
      ],
    },
    select: { id: true, status: true },
  });

  if (!row) {
    // Unknown row — Eskiz sometimes fires callbacks for messages we no longer
    // have (e.g. test sends from before the integration shipped). 200-OK
    // silently so Eskiz doesn't keep retrying.
    console.log(
      `[Eskiz Webhook] No matching SmsHistory for request_id=${payload.request_id} user_sms_id=${payload.user_sms_id} — ignoring`,
    );
    return NextResponse.json({ status: "ok" });
  }

  const mapped = mapEskizStatus(payload.status);
  if (!mapped) {
    // Intermediate state — keep eskizMessageId fresh, leave status alone.
    if (payload.message_id) {
      await prisma.smsHistory.update({
        where: { id: row.id },
        data: { eskizMessageId: parseInt(payload.message_id, 10) || null },
      });
    }
    return NextResponse.json({ status: "intermediate" });
  }

  // ─── Apply terminal state ───
  const deliveredAt =
    mapped.status === "DELIVERED"
      ? (parseStatusDate(payload.status_date) ?? new Date())
      : undefined;

  await prisma.smsHistory.update({
    where: { id: row.id },
    data: {
      status: mapped.status,
      deliveredAt,
      failureReason: mapped.reason ?? null,
      eskizMessageId: payload.message_id
        ? parseInt(payload.message_id, 10) || null
        : undefined,
    },
  });

  console.log(
    `[Eskiz Webhook] ${row.id}: ${row.status} → ${mapped.status} (eskiz_status=${payload.status})`,
  );

  return NextResponse.json({ status: "ok" });
}
