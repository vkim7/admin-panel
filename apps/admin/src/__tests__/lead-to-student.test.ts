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
  preferredDays: [],
  preferredTimeSlots: [],
  testLevelSent: null,
  testScore: null,
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

  it("copies preferredDays and preferredTimeSlots from lead", () => {
    const result = mapLeadToStudentDefaults({
      ...baseLead,
      preferredDays: [1, 3, 5],
      preferredTimeSlots: ["19:00", "20:30"],
    });
    expect(result.preferredDays).toEqual([1, 3, 5]);
    expect(result.preferredTimeSlots).toEqual(["19:00", "20:30"]);
  });

  it("filters out time slots that aren't in TIME_SLOTS before prefill", () => {
    const result = mapLeadToStudentDefaults({
      ...baseLead,
      preferredTimeSlots: ["19:00", "06:15", "20:30"], // "06:15" isn't a canonical slot
    });
    expect(result.preferredTimeSlots).toEqual(["19:00", "20:30"]);
  });

  it("prefills level from testLevelSent (takes precedence over selfAssessedLevel)", () => {
    const result = mapLeadToStudentDefaults({
      ...baseLead,
      selfAssessedLevel: "COMPLETE_BEGINNER",
      testLevelSent: "PRE_INTERMEDIATE",
    });
    expect(result.level).toBe("PRE_INTERMEDIATE");
  });

  it("falls back to BEGINNER when no testLevelSent and selfAssessedLevel is COMPLETE_BEGINNER", () => {
    const result = mapLeadToStudentDefaults({
      ...baseLead,
      selfAssessedLevel: "COMPLETE_BEGINNER",
      testLevelSent: null,
    });
    expect(result.level).toBe("BEGINNER");
  });

  it("prepends placement-test summary to comment when score+level are set", () => {
    const result = mapLeadToStudentDefaults({
      ...baseLead,
      note: "after work",
      testLevelSent: "ELEMENTARY",
      testScore: 68,
    });
    expect(result.comment).toBe("Placement test: 68/100 (ELEMENTARY)\nafter work");
  });

  it("includes placement-test summary even when lead.note is null", () => {
    const result = mapLeadToStudentDefaults({
      ...baseLead,
      note: null,
      testLevelSent: "ELEMENTARY",
      testScore: 72,
    });
    expect(result.comment).toBe("Placement test: 72/100 (ELEMENTARY)");
  });

  it("omits placement-test summary when only score is set (no level)", () => {
    const result = mapLeadToStudentDefaults({
      ...baseLead,
      note: "after work",
      testLevelSent: null,
      testScore: 50,
    });
    expect(result.comment).toBe("after work");
  });

  it("omits placement-test summary when only level is set (no score)", () => {
    const result = mapLeadToStudentDefaults({
      ...baseLead,
      note: "after work",
      testLevelSent: "ELEMENTARY",
      testScore: null,
    });
    expect(result.comment).toBe("after work");
  });
});
