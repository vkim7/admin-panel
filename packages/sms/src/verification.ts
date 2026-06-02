import { checkAllowlist, warnIfAllowlistDisabledInProduction } from "./allowlist";
import { credentialsFromEnv, getActiveToken } from "./auth";
import { EskizError, sendSms as liveSendSms } from "./client";
import { mockSendSms } from "./mock";
import { toEskizFormat } from "./phone";
import { loadTemplate, render } from "./template";
import type { SmsLanguage } from "./types";

export type VerificationSendResult =
  | { ok: true }
  | { ok: false; reason: string; status: "FAILED" | "SKIPPED" };

/**
 * Send a verification code SMS to a phone number that does NOT yet have a Lead
 * or Student row. This bypasses SmsHistory (which requires leadId XOR studentId)
 * — the audit trail for verification SMS lives in PhoneVerification.
 *
 * Same Eskiz path as `sendTemplatedSms`: loads the approved template, renders
 * `{code}`, honors SMS_ALLOWED_PHONES, switches between live and mock.
 */
export async function sendVerificationSms(opts: {
  phone: string;
  language: SmsLanguage;
  code: string;
}): Promise<VerificationSendResult> {
  warnIfAllowlistDisabledInProduction(
    process.env.SMS_ALLOWED_PHONES,
    process.env.NODE_ENV,
  );

  const template = await loadTemplate({
    code: "verification",
    language: opts.language,
  });
  if (!template) {
    return {
      ok: false,
      status: "FAILED",
      reason: `Template verification/${opts.language} not found or inactive`,
    };
  }

  const message = render(template.body, { code: opts.code });

  const allowlistDecision = checkAllowlist(
    opts.phone,
    process.env.SMS_ALLOWED_PHONES,
  );
  if (!allowlistDecision.allowed) {
    return {
      ok: false,
      status: "SKIPPED",
      reason: allowlistDecision.reason ?? "Allowlist rejected",
    };
  }

  if (template.eskizTemplateId === null) {
    return {
      ok: false,
      status: "FAILED",
      reason: "Template pending Eskiz approval",
    };
  }

  const from = process.env.ESKIZ_FROM ?? "4546";
  const callbackUrl = process.env.ESKIZ_CALLBACK_URL;
  const mode = process.env.ESKIZ_MODE ?? "live";

  try {
    const eskizReq = {
      mobilePhone: toEskizFormat(opts.phone),
      message,
      from,
      callbackUrl,
    };

    if (mode === "mock") {
      await mockSendSms({ ...eskizReq, token: "mock" });
    } else {
      const token = await getActiveToken(credentialsFromEnv());
      await liveSendSms({ ...eskizReq, token });
    }

    return { ok: true };
  } catch (err) {
    const reason =
      err instanceof EskizError
        ? `Eskiz ${err.status}: ${err.body.slice(0, 200)}`
        : err instanceof Error
          ? err.message
          : String(err);
    return { ok: false, status: "FAILED", reason };
  }
}
