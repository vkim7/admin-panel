/**
 * A recipient is either a lead (pre-conversion) or a student (post-conversion).
 * Exactly one of leadId / studentId is set — this matches the polymorphic
 * SmsHistory schema and its CHECK constraint.
 */
export type Recipient =
  | { leadId: string; studentId?: never; phone: string; language: SmsLanguage }
  | { studentId: string; leadId?: never; phone: string; language: SmsLanguage };

export type SmsLanguage = "ru" | "uz";

export type TemplateCode = "lead_greeting" | "lead_callback_reminder";

export interface TemplateVariables {
  /** First name — substituted for {name} in template body */
  name: string;
}

/**
 * Result of an attempted send. Always returns success-shape because we always
 * write a SmsHistory row (even on failure / skip / pending-approval); callers
 * use this to decide whether to surface an error toast.
 */
export type SendResult =
  | { ok: true; smsHistoryId: string; status: "SENT" }
  | {
      ok: false;
      smsHistoryId: string;
      status: "FAILED" | "SKIPPED";
      reason: string;
    };
