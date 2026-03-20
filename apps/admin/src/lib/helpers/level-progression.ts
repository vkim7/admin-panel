import type { Level } from "@eng/database";

const LEVEL_ORDER: Level[] = [
  "BEGINNER",
  "ELEMENTARY",
  "PRE_INTERMEDIATE",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "IELTS",
];

/**
 * Get the next level in the progression.
 * Returns null for IELTS (no next level).
 */
export function getNextLevel(current: Level): Level | null {
  const idx = LEVEL_ORDER.indexOf(current);
  if (idx === -1 || idx === LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1]!;
}

/**
 * Check if a group is eligible for graduation.
 * Returns { eligible: true } or { eligible: false, reason: string }.
 */
export function canGraduate(group: {
  level: Level;
  isActive: boolean;
  skipAutoGraduation: boolean;
  lessons: { status: string }[];
}): { eligible: true } | { eligible: false; reason: string } {
  if (!group.isActive) {
    return { eligible: false, reason: "Group is not active" };
  }

  if (group.level === "IELTS") {
    return { eligible: false, reason: "IELTS groups cannot graduate — there is no next level" };
  }

  if (group.skipAutoGraduation) {
    return { eligible: false, reason: "Auto-graduation is disabled for this group" };
  }

  const hasUnfinished = group.lessons.some(
    (l) => l.status === "SCHEDULED" || l.status === "PENDING_RESOLUTION",
  );
  if (hasUnfinished) {
    return { eligible: false, reason: "All lessons must be completed or cancelled before graduation" };
  }

  return { eligible: true };
}
