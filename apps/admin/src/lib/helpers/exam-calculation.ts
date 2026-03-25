/**
 * Calculate mid and final exam dates from a group's lesson array.
 * Sorts by lessonDate internally — callers don't need to pre-sort.
 *
 * - Mid exam: lesson number Math.floor(total / 2) (e.g. lesson 18 of 36)
 * - Final exam: 3rd from end, lesson number total - 2 (e.g. lesson 34 of 36)
 * - Returns null if fewer than 5 lessons (too few for a meaningful split)
 */
export function calculateExamDates(
  lessons: { lessonDate: Date }[],
): { mid: Date; final: Date } | null {
  const total = lessons.length;
  if (total < 5) return null;

  const sorted = [...lessons].sort(
    (a, b) => a.lessonDate.getTime() - b.lessonDate.getTime(),
  );

  const midIndex = Math.floor(total / 2) - 1;
  const finalIndex = total - 3;

  return {
    mid: sorted[midIndex]!.lessonDate,
    final: sorted[finalIndex]!.lessonDate,
  };
}
