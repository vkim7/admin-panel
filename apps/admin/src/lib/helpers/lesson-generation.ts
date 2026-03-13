import type { LevelCategory } from "@eng/database";

/**
 * C#19: Calculate group end date from start date.
 * day < 15 → end of month+2; day >= 15 → end of month+3
 */
export function calculateEndDate(startDate: Date): Date {
  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth(); // 0-indexed
  const day = startDate.getUTCDate();

  const monthsToAdd = day < 15 ? 3 : 4;
  // End of month = day 0 of next month
  return new Date(Date.UTC(year, month + monthsToAdd, 0));
}

/**
 * Generate all lesson dates between startDate and endDate matching the day pattern,
 * skipping holidays. Returns sorted Date[].
 *
 * @param startDate - first possible lesson date (inclusive)
 * @param endDate - last possible lesson date (inclusive)
 * @param days - ISO day-of-week pattern, e.g. [1, 3, 5] for Mon/Wed/Fri
 * @param holidayDates - Set of ISO date strings (YYYY-MM-DD) to skip
 */
export function generateLessonDates(
  startDate: Date,
  endDate: Date,
  days: number[],
  holidayDates: Set<string>,
): Date[] {
  const result: Date[] = [];
  const daysSet = new Set(days);

  const current = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ),
  );

  while (current <= end) {
    // getUTCDay() returns 0=Sun, 1=Mon, ..., 6=Sat
    // Convert to ISO: 1=Mon, ..., 7=Sun
    const jsDay = current.getUTCDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    if (daysSet.has(isoDay)) {
      const dateStr = current.toISOString().split("T")[0]!;
      if (!holidayDates.has(dateStr)) {
        result.push(new Date(current));
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

/**
 * Derive level category from level enum.
 * IELTS → "IELTS", everything else → "GENERAL"
 */
export function getLevelCategory(level: string): LevelCategory {
  return level === "IELTS" ? "IELTS" : "GENERAL";
}

/**
 * Compute progress stage from the group's start/end dates and today's date.
 *
 * Short groups (~3 calendar months, startDate day < 15):
 *   Month 1 = BEGINNING, Month 2 = MID, Month 3 = FINAL
 *
 * Long groups (~4 calendar months, startDate day >= 15):
 *   Months 1–2 = BEGINNING, Month 3 = MID, Month 4 = FINAL
 */
export function getProgressStage(
  startDate: Date,
  endDate: Date,
): "BEGINNING" | "MID" | "FINAL" {
  const now = new Date();
  if (now < startDate) return "BEGINNING";
  if (now > endDate) return "FINAL";

  const startMonth =
    startDate.getUTCFullYear() * 12 + startDate.getUTCMonth();
  const endMonth = endDate.getUTCFullYear() * 12 + endDate.getUTCMonth();
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();

  const totalMonths = endMonth - startMonth + 1;
  const monthIndex = currentMonth - startMonth; // 0-based

  if (totalMonths <= 3) {
    // Short: 0=BEG, 1=MID, 2=FIN
    if (monthIndex === 0) return "BEGINNING";
    if (monthIndex >= totalMonths - 1) return "FINAL";
    return "MID";
  } else {
    // Long: 0,1=BEG, 2=MID, 3+=FIN
    if (monthIndex <= 1) return "BEGINNING";
    if (monthIndex >= totalMonths - 1) return "FINAL";
    return "MID";
  }
}

/**
 * Auto-calculate lessonsStart from joinDate.
 * Returns the lesson number of the first lesson on or after joinDate.
 */
export function calculateLessonsStart(
  lessons: { lessonNumber: number; lessonDate: Date }[],
  joinDate: Date,
): number | null {
  const joinUTC = new Date(
    Date.UTC(
      joinDate.getUTCFullYear(),
      joinDate.getUTCMonth(),
      joinDate.getUTCDate(),
    ),
  );
  const first = lessons.find((l) => l.lessonDate >= joinUTC);
  return first?.lessonNumber ?? null;
}
