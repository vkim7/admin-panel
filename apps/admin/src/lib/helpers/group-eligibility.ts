import type { GroupType, LessonPreference } from "@eng/database";

/**
 * Hard filter: a student with a specific lesson-type preference (GROUP or
 * INDIVIDUAL) is only eligible for groups of that type. EITHER students
 * are eligible for both. Used by the assign dialog so admins can't
 * accidentally place an individual-only student into a group class.
 */
export function isEligibleByLessonType(
  preferredLessonType: LessonPreference,
  groupType: GroupType,
): boolean {
  if (preferredLessonType === "EITHER") return true;
  return preferredLessonType === groupType;
}
