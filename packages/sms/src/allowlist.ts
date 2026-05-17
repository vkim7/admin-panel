/**
 * SMS_ALLOWED_PHONES guardrail: a kill-switch for non-prod environments.
 *
 * Semantics:
 *   - Empty / unset env var → allowlist is OFF. Send to everyone.
 *   - Non-empty → allowlist is ON. Only send to phones in the list.
 *
 * Format: comma-separated canonical phones, e.g. `+998000000000,+998901234567`.
 * Whitespace around commas is tolerated.
 *
 * The funnel in send.ts calls isAllowed() before touching Eskiz. When the
 * allowlist excludes a recipient, the funnel writes a SmsHistory row with
 * status=SKIPPED so the would-have-sent attempt is still visible in the UI.
 */
export function parseAllowedPhones(
  raw: string | undefined,
): readonly string[] | null {
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

export interface AllowlistDecision {
  allowed: boolean;
  /** Human-readable reason when allowed=false; suitable for SmsHistory.failureReason */
  reason?: string;
}

/**
 * Decide whether a single recipient phone is allowed to receive SMS in the
 * current environment. Pass `process.env.SMS_ALLOWED_PHONES` for `raw`.
 */
export function checkAllowlist(
  phone: string,
  raw: string | undefined,
): AllowlistDecision {
  const list = parseAllowedPhones(raw);
  if (list === null) return { allowed: true };
  if (list.includes(phone)) return { allowed: true };
  return {
    allowed: false,
    reason: `Phone ${phone} not in SMS_ALLOWED_PHONES allowlist`,
  };
}

/**
 * Emit a one-time boot warning if we're in production-like environment with
 * the allowlist OFF. Call once from each app on startup (or first send).
 * Helps catch the "forgot to set the kill-switch on staging" foot-gun.
 */
let warned = false;
export function warnIfAllowlistDisabledInProduction(
  raw: string | undefined,
  nodeEnv: string | undefined,
): void {
  if (warned) return;
  if (nodeEnv === "production" && parseAllowedPhones(raw) === null) {
    // eslint-disable-next-line no-console
    console.warn(
      "[@eng/sms] ⚠️  SMS_ALLOWED_PHONES is not set — SMS will be sent to all recipients.",
    );
  }
  warned = true;
}
