/**
 * Calculate age from a date of birth.
 * Handles serialized Date strings from Server Component props.
 */
export function getAge(dateOfBirth: Date): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get today's date in Uzbekistan timezone (Asia/Tashkent, UTC+5).
 * Returns a Date set to midnight UTC representing today in Tashkent.
 *
 * Why: Admins work in Tashkent time. A 1 AM Tashkent session = 20:00 UTC previous day.
 * Using UTC naively would make "today" refer to yesterday from the admin's perspective.
 */
export function getUzbekistanToday(): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
  });
  const todayStr = formatter.format(new Date());
  return new Date(todayStr + "T00:00:00Z");
}

/**
 * Get today's date string in Uzbekistan timezone as "YYYY-MM-DD".
 * Client-safe — usable in components for date input `min` attributes.
 */
export function getUzbekistanTodayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
  }).format(new Date());
}
