/**
 * Convert HH:mm time string to minutes since midnight.
 * Shared helper — extracted from group-memberships.ts.
 */
export function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

/**
 * Check if two time ranges overlap.
 * Handles whole-day (null start = conflicts with everything)
 * and open-ended (null end with start set = from start onwards).
 */
export function timeRangesOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  // If either is whole-day (null start), always conflicts
  if (aStart === null || bStart === null) return true;

  const aStartMin = timeToMinutes(aStart);
  const bStartMin = timeToMinutes(bStart);

  // Open-ended: treat as end-of-day (24:00 = 1440)
  const aEndMin = aEnd ? timeToMinutes(aEnd) : 1440;
  const bEndMin = bEnd ? timeToMinutes(bEnd) : 1440;

  return aStartMin < bEndMin && bStartMin < aEndMin;
}

/**
 * Find the next valid date after `afterDate` that matches the day pattern
 * and is not a holiday. Safety limit: 60 days.
 *
 * @param afterDate - search starts the day after this date
 * @param days - ISO day-of-week pattern, e.g. [1, 3, 5]
 * @param holidayDates - Set of ISO date strings (YYYY-MM-DD) to skip
 */
export function findNextValidDate(
  afterDate: Date,
  days: number[],
  holidayDates: Set<string>,
): Date | null {
  const daysSet = new Set(days);
  const current = new Date(
    Date.UTC(
      afterDate.getUTCFullYear(),
      afterDate.getUTCMonth(),
      afterDate.getUTCDate() + 1,
    ),
  );

  for (let i = 0; i < 60; i++) {
    const jsDay = current.getUTCDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    if (daysSet.has(isoDay)) {
      const dateStr = current.toISOString().split("T")[0]!;
      if (!holidayDates.has(dateStr)) {
        return new Date(current);
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return null;
}
