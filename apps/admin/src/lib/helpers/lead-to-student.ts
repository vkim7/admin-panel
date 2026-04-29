import type { Lead } from "@eng/database";
import type { StudentFormValues } from "@/schemas/student";

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
>;

export function mapLeadToStudentDefaults(lead: LeadPrefillFields): Partial<StudentFormValues> {
  const defaults: Partial<StudentFormValues> = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    preferredLessonType: lead.lessonPreference ?? "EITHER",
    preferredLanguage: mapLanguage(lead.language),
    comment: lead.note ?? null,
  };

  if (lead.dateOfBirth) {
    defaults.dateOfBirth = lead.dateOfBirth.toISOString().slice(0, 10);
  }

  if (lead.selfAssessedLevel === "COMPLETE_BEGINNER") {
    defaults.level = "BEGINNER";
  }

  return defaults;
}

function mapLanguage(lang: string): StudentFormValues["preferredLanguage"] {
  if (lang === "uz") return "UZBEK";
  if (lang === "ru") return "RUSSIAN";
  return "ANY";
}
