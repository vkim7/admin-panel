import { describe, it, expect } from "vitest";
import { mapLeadToStudentDefaults } from "@/lib/helpers/lead-to-student";

const baseLead = {
  firstName: "Aziz",
  lastName: "Karimov",
  phone: "+998901111111",
  dateOfBirth: new Date("2005-06-15T00:00:00Z"),
  language: "uz",
  lessonPreference: "GROUP" as const,
  selfAssessedLevel: "COMPLETE_BEGINNER" as const,
  note: "wants to start in May",
};

describe("mapLeadToStudentDefaults", () => {
  it("maps name, phone, and DOB 1:1 (DOB as YYYY-MM-DD)", () => {
    const result = mapLeadToStudentDefaults(baseLead);
    expect(result.firstName).toBe("Aziz");
    expect(result.lastName).toBe("Karimov");
    expect(result.phone).toBe("+998901111111");
    expect(result.dateOfBirth).toBe("2005-06-15");
  });

  it("maps language uz/ru/other to UZBEK/RUSSIAN/ANY", () => {
    expect(mapLeadToStudentDefaults({ ...baseLead, language: "uz" }).preferredLanguage).toBe("UZBEK");
    expect(mapLeadToStudentDefaults({ ...baseLead, language: "ru" }).preferredLanguage).toBe("RUSSIAN");
    expect(mapLeadToStudentDefaults({ ...baseLead, language: "en" }).preferredLanguage).toBe("ANY");
  });

  it("maps lessonPreference 1:1 and falls back to EITHER when null", () => {
    expect(mapLeadToStudentDefaults({ ...baseLead, lessonPreference: "GROUP" }).preferredLessonType).toBe("GROUP");
    expect(mapLeadToStudentDefaults({ ...baseLead, lessonPreference: "INDIVIDUAL" }).preferredLessonType).toBe("INDIVIDUAL");
    expect(mapLeadToStudentDefaults({ ...baseLead, lessonPreference: null }).preferredLessonType).toBe("EITHER");
  });

  it("prefills level=BEGINNER only when selfAssessedLevel=COMPLETE_BEGINNER", () => {
    expect(mapLeadToStudentDefaults({ ...baseLead, selfAssessedLevel: "COMPLETE_BEGINNER" }).level).toBe("BEGINNER");
    expect(mapLeadToStudentDefaults({ ...baseLead, selfAssessedLevel: "CONTINUING" }).level).toBeUndefined();
    expect(mapLeadToStudentDefaults({ ...baseLead, selfAssessedLevel: null }).level).toBeUndefined();
  });

  it("maps note → comment, treats null as null", () => {
    expect(mapLeadToStudentDefaults({ ...baseLead, note: "hi" }).comment).toBe("hi");
    expect(mapLeadToStudentDefaults({ ...baseLead, note: null }).comment).toBeNull();
  });

  it("omits dateOfBirth when the lead has none", () => {
    const result = mapLeadToStudentDefaults({ ...baseLead, dateOfBirth: null });
    expect(result.dateOfBirth).toBeUndefined();
  });
});
