/**
 * t.me/+E164 — Telegram resolves phone-prefixed links to the matching account
 * when the lead has phone-discoverability enabled. Falls back to a no-op page
 * when no account exists; admin can paste the phone manually in that case.
 *
 * Phones in the DB are stored as `+998XXXXXXXXX` (validated by `requiredPhone`).
 */
export function telegramLink(phone: string): string {
  const trimmed = phone.trim();
  const withPlus = trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/\D/g, "")}`;
  return `https://t.me/${withPlus}`;
}
