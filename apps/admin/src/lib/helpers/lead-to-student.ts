import type { Lead } from "@eng/database";
import type { StudentFormValues } from "@/schemas/student";
import { TIME_SLOTS } from "@/lib/constants";

type LeadPrefillFields = Pick<
  Lead,
  | "firstName"
  | "lastName"
  | "phone"
  | "dateOfBirth"
  | "language"
  | "lessonPreference"
  | "selfAssessedLevel"
  | "note"
  | "preferredDays"
  | "preferredTimeSlots"
  | "preferredLanguage"
  | "testLevelSent"
  | "testScore"
>;

export function mapLeadToStudentDefaults(
  lead: LeadPrefillFields,
): Partial<StudentFormValues> {
  const defaults: Partial<StudentFormValues> = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    preferredLessonType: lead.lessonPreference ?? "EITHER",
    // Prefer the admin-captured preferredLanguage. Fall back to mapping the
    // form's URL locale when admin hasn't captured one yet.
    preferredLanguage:
      lead.preferredLanguage ?? mapLanguage(lead.language),
    comment: buildComment(lead),
    preferredDays: lead.preferredDays,
    // Filter to slots known to the Group scheduler; anything else is ignored
    // rather than blowing up the form validator.
    preferredTimeSlots: lead.preferredTimeSlots.filter(
      (slot): slot is (typeof TIME_SLOTS)[number] =>
        (TIME_SLOTS as readonly string[]).includes(slot),
    ),
  };

  if (lead.dateOfBirth) {
    defaults.dateOfBirth = lead.dateOfBirth.toISOString().slice(0, 10);
  }

  // Level: prefer the placement-test level when known, fall back to BEGINNER
  // for self-declared complete beginners.
  if (lead.testLevelSent) {
    defaults.level = lead.testLevelSent;
  } else if (lead.selfAssessedLevel === "COMPLETE_BEGINNER") {
    defaults.level = "BEGINNER";
  }

  return defaults;
}

function mapLanguage(lang: string): StudentFormValues["preferredLanguage"] {
  if (lang === "uz") return "UZBEK";
  if (lang === "ru") return "RUSSIAN";
  return "ANY";
}

// Drops the visitor's note + test score into the comment so the admin sees the
// qualifying conversation context on the student form.
function buildComment(lead: LeadPrefillFields): string | null {
  const parts: string[] = [];
  if (lead.testScore !== null && lead.testLevelSent) {
    parts.push(`Placement test: ${lead.testScore}/100 (${lead.testLevelSent})`);
  }
  if (lead.note) parts.push(lead.note);
  return parts.length > 0 ? parts.join("\n") : null;
}
