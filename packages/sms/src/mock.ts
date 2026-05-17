import type { SendSmsRequest, SendSmsResponse } from "./client";

/**
 * Fake Eskiz responses for local dev and preview deploys (`ESKIZ_MODE=mock`).
 *
 * - No network calls — everything resolves locally.
 * - Returns plausible shapes so the rest of the funnel exercises real code
 *   paths (write SmsHistory with eskizRequestId, etc.).
 * - Logs to stdout so the developer can see what would have been sent.
 *
 * The webhook flow can also be tested in mock mode: after a mock send, you
 * can manually POST to /api/webhooks/eskiz with the returned `id` to verify
 * the status-transition path works end-to-end.
 */

function mockUuid(): string {
  // RFC4122-ish v4. Good enough for SmsHistory.eskizRequestId.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function mockSendSms(
  req: SendSmsRequest,
): Promise<SendSmsResponse> {
  const id = mockUuid();
  // eslint-disable-next-line no-console
  console.log(
    `[@eng/sms:mock] would send to ${req.mobilePhone} from "${req.from}" (callback=${req.callbackUrl ?? "none"}, user_sms_id=${req.userSmsId ?? "none"}):\n${req.message}\n→ id=${id}`,
  );
  return {
    id,
    status: "waiting",
    message: "Waiting for SMS provider (mock)",
  };
}
