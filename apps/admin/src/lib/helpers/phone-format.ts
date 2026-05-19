/**
 * Format an Uzbek phone number for display: `(NN) NNN-NN-NN`.
 *
 * Drops the +998 country code — all leads/students are UZ-local, and admin
 * staff scan these on calls where the prefix is just noise. Accepts any input
 * shape (strips non-digits first); returns the original string unchanged if
 * it isn't a 12-digit +998 number, so we never lose data on malformed entries.
 */
export function formatUzPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 12 || !digits.startsWith("998")) return phone;
  return `(${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
}
