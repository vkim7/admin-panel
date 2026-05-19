import { prisma } from "@eng/database";
import {
  checkAllowlist,
  warnIfAllowlistDisabledInProduction,
} from "./allowlist";
import { credentialsFromEnv, getActiveToken } from "./auth";
import { EskizError, sendSms as liveSendSms } from "./client";
import { mockSendSms } from "./mock";
import { toEskizFormat } from "./phone";
import { loadTemplate, render } from "./template";
import type { Recipient, SendResult, TemplateCode, TemplateVariables } from "./types";

export interface SendTemplatedSmsInput {
  recipient: Recipient;
  templateCode: TemplateCode;
  variables: TemplateVariables;
  /** Admin user id (when triggered manually) — null for system sends like the lead-greeting */
  sentById?: string | null;
}

/**
 * The single funnel for all outgoing SMS in the codebase.
 *
 * Behavior — always writes a SmsHistory row, regardless of outcome, so every
 * trigger is visible in the per-recipient timeline:
 *
 *   1. Load template by (code, language). Missing template → FAILED.
 *   2. Render body with variables.
 *   3. If SMS_ALLOWED_PHONES is set and excludes recipient.phone → SKIPPED.
 *      (Allowlist is an explicit operator guardrail — it wins over any other
 *       reason-not-to-send below.)
 *   4. If template.eskizTemplateId is null (still in Eskiz moderation) → FAILED.
 *   5. If ESKIZ_MODE=mock → call mock client. Else → real Eskiz call.
 *   6. On Eskiz success → SENT, with eskizRequestId stored for the webhook.
 *   7. On Eskiz HTTP failure → FAILED with the error captured.
 *
 * Never throws — returns SendResult. Callers route on result.ok to surface
 * toasts vs. silent log.
 */
export async function sendTemplatedSms(
  input: SendTemplatedSmsInput,
): Promise<SendResult> {
  warnIfAllowlistDisabledInProduction(
    process.env.SMS_ALLOWED_PHONES,
    process.env.NODE_ENV,
  );

  const { recipient, templateCode, variables, sentById } = input;

  // 1. Load template
  const template = await loadTemplate({
    code: templateCode,
    language: recipient.language,
  });
  if (!template) {
    return await recordHistory({
      recipient,
      sentById: sentById ?? null,
      language: recipient.language,
      templateId: null,
      message: `<template ${templateCode}/${recipient.language} not found>`,
      status: "FAILED",
      failureReason: `Template ${templateCode}/${recipient.language} not found or inactive`,
    });
  }

  // 2. Render (works regardless of moderation state — body has placeholders)
  const message = render(template.body, variables);

  // 3. Allowlist guardrail. Checked BEFORE template approval so that a
  // deliberate operator decision (the kill-switch is on, this phone isn't
  // allowed) takes precedence over transient system state (template is
  // still in Eskiz moderation). SKIPPED is the right user-facing status here.
  const allowlistDecision = checkAllowlist(
    recipient.phone,
    process.env.SMS_ALLOWED_PHONES,
  );
  if (!allowlistDecision.allowed) {
    return await recordHistory({
      recipient,
      sentById: sentById ?? null,
      language: recipient.language,
      templateId: template.id,
      message,
      status: "SKIPPED",
      failureReason: allowlistDecision.reason ?? "Allowlist rejected",
    });
  }

  // 4. Template must be Eskiz-approved before we can actually send
  if (template.eskizTemplateId === null) {
    return await recordHistory({
      recipient,
      sentById: sentById ?? null,
      language: recipient.language,
      templateId: template.id,
      message,
      status: "FAILED",
      failureReason: "Template pending Eskiz approval",
    });
  }

  // 5/6/7. Call Eskiz (or mock) and record outcome.
  //
  // We don't pass user_sms_id to Eskiz: their gateway rejects long values
  // (36-char UUIDs come back as "user_sms_id is invalid"), and we don't
  // need it — the webhook handler correlates rows via eskizRequestId
  // (the UUID Eskiz returns synchronously and echoes back in callbacks).
  const from = process.env.ESKIZ_FROM ?? "4546";
  const callbackUrl = process.env.ESKIZ_CALLBACK_URL;
  const mode = process.env.ESKIZ_MODE ?? "live";

  try {
    const eskizReq = {
      mobilePhone: toEskizFormat(recipient.phone),
      message,
      from,
      callbackUrl,
      // token is supplied below per mode
    };

    let eskizRes;
    if (mode === "mock") {
      eskizRes = await mockSendSms({ ...eskizReq, token: "mock" });
    } else {
      const token = await getActiveToken(credentialsFromEnv());
      eskizRes = await liveSendSms({ ...eskizReq, token });
    }

    return await recordHistory({
      recipient,
      sentById: sentById ?? null,
      language: recipient.language,
      templateId: template.id,
      message,
      status: "SENT",
      eskizRequestId: eskizRes.id,
    });
  } catch (err) {
    const reason =
      err instanceof EskizError
        ? `Eskiz ${err.status}: ${err.body.slice(0, 200)}`
        : err instanceof Error
          ? err.message
          : String(err);

    return await recordHistory({
      recipient,
      sentById: sentById ?? null,
      language: recipient.language,
      templateId: template.id,
      message,
      status: "FAILED",
      failureReason: reason,
    });
  }
}

// ─── Internal: write the SmsHistory row ─────────────────────────────────────

interface RecordHistoryInput {
  id?: string;
  recipient: Recipient;
  sentById: string | null;
  language: string;
  templateId: string | null;
  message: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  failureReason?: string;
  eskizRequestId?: string;
}

async function recordHistory(input: RecordHistoryInput): Promise<SendResult> {
  const row = await prisma.smsHistory.create({
    data: {
      id: input.id,
      studentId: input.recipient.studentId ?? null,
      leadId: input.recipient.leadId ?? null,
      phone: input.recipient.phone,
      message: input.message,
      language: input.language,
      templateId: input.templateId,
      sentById: input.sentById,
      status: input.status,
      failureReason: input.failureReason ?? null,
      eskizRequestId: input.eskizRequestId ?? null,
    },
    select: { id: true },
  });

  if (input.status === "SENT") {
    return { ok: true, smsHistoryId: row.id, status: "SENT" };
  }
  return {
    ok: false,
    smsHistoryId: row.id,
    status: input.status,
    reason: input.failureReason ?? "Unknown",
  };
}
