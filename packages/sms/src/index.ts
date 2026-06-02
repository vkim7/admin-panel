/**
 * @eng/sms — single funnel for all outgoing SMS in the codebase.
 *
 * Apps call `sendTemplatedSms()` and that's it. The funnel:
 *   - loads the approved Eskiz template by (code, language)
 *   - substitutes {name} with provided variables
 *   - applies the SMS_ALLOWED_PHONES guardrail
 *   - manages the Eskiz JWT (login + refresh, DB-cached)
 *   - writes a SmsHistory row (always, regardless of outcome)
 *
 * The webhook handler (apps/admin/src/app/api/webhooks/eskiz/route.ts)
 * mutates SmsHistory.status SENT → DELIVERED/FAILED as delivery callbacks arrive.
 */

export { sendTemplatedSms } from "./send";
export type { SendTemplatedSmsInput } from "./send";
export { sendVerificationSms } from "./verification";
export type { VerificationSendResult } from "./verification";
export type {
  Recipient,
  SendResult,
  SmsLanguage,
  TemplateCode,
  TemplateVariables,
} from "./types";
