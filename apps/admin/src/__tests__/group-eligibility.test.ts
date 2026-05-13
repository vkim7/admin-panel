import { describe, it, expect } from "vitest";
import { isEligibleByLessonType } from "@/lib/helpers/group-eligibility";

describe("isEligibleByLessonType", () => {
  it("EITHER students are eligible for both GROUP and INDIVIDUAL groups", () => {
    expect(isEligibleByLessonType("EITHER", "GROUP")).toBe(true);
    expect(isEligibleByLessonType("EITHER", "INDIVIDUAL")).toBe(true);
  });

  it("GROUP-pref students are eligible only for GROUP-type groups", () => {
    expect(isEligibleByLessonType("GROUP", "GROUP")).toBe(true);
    expect(isEligibleByLessonType("GROUP", "INDIVIDUAL")).toBe(false);
  });

  it("INDIVIDUAL-pref students are eligible only for INDIVIDUAL-type groups", () => {
    expect(isEligibleByLessonType("INDIVIDUAL", "INDIVIDUAL")).toBe(true);
    expect(isEligibleByLessonType("INDIVIDUAL", "GROUP")).toBe(false);
  });
});
