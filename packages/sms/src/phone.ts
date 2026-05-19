/**
 * Convert a stored phone (`+998979798808`) to the format Eskiz expects
 * in `mobile_phone` / `to`: digits only, no `+`, no spaces.
 *
 * Eskiz documents the format as `998991234567`. They reject anything else.
 */
export function toEskizFormat(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Validate the canonical Uzbek phone shape we store everywhere: `+998` then
 * exactly 9 digits. Returns the phone unchanged if valid, throws otherwise.
 * Use this at allowlist/match points where a malformed phone would silently
 * bypass the SMS_ALLOWED_PHONES guard.
 */
export function assertUzbekPhone(phone: string): string {
  if (!/^\+998\d{9}$/.test(phone)) {
    throw new Error(
      `Phone must be in canonical form +998XXXXXXXXX, got: ${JSON.stringify(phone)}`,
    );
  }
  return phone;
}
