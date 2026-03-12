import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  isBlank,
  requiredString,
  nullableString,
  requiredId,
  nullableId,
  booleanWithDefault,
  nullableBoolean,
  requiredIsoDate,
  nullableIsoDate,
  requiredTime,
  nullableTime,
  requiredInt,
  nullableInt,
  requiredIdArray,
  optionalIdArray,
} from "@/schemas/helpers";

// =============================================================================
// isBlank
// =============================================================================
describe("isBlank", () => {
  it("returns true for null", () => {
    expect(isBlank(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isBlank(undefined)).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(isBlank("")).toBe(true);
  });

  it("returns true for whitespace-only string", () => {
    expect(isBlank("   ")).toBe(true);
    expect(isBlank("\t")).toBe(true);
    expect(isBlank("\n")).toBe(true);
    expect(isBlank("  \t\n  ")).toBe(true);
  });

  it("returns false for non-empty string", () => {
    expect(isBlank("hello")).toBe(false);
    expect(isBlank("  hello  ")).toBe(false);
  });

  it("returns false for zero", () => {
    expect(isBlank(0)).toBe(false);
  });

  it("returns false for false", () => {
    expect(isBlank(false)).toBe(false);
  });

  it("returns false for objects and arrays", () => {
    expect(isBlank({})).toBe(false);
    expect(isBlank([])).toBe(false);
  });
});

// =============================================================================
// requiredString
// =============================================================================
describe("requiredString", () => {
  const schema = requiredString("Name is required");

  describe("valid inputs", () => {
    it("accepts non-empty string", () => {
      expect(schema.parse("John")).toBe("John");
    });

    it("trims whitespace and accepts", () => {
      expect(schema.parse("  John  ")).toBe("John");
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      expect(() => schema.parse("")).toThrow();
    });

    it("rejects whitespace-only string", () => {
      expect(() => schema.parse("   ")).toThrow();
      expect(() => schema.parse("\t")).toThrow();
      expect(() => schema.parse("\n")).toThrow();
    });

    it("uses custom error message", () => {
      const result = schema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes("Name is required"))).toBe(
          true,
        );
      }
    });
  });

  describe("default error message", () => {
    it("uses 'Required' as default error", () => {
      const result = requiredString().safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes("Required"))).toBe(true);
      }
    });
  });
});

// =============================================================================
// nullableString
// =============================================================================
describe("nullableString", () => {
  describe("without maxLength", () => {
    const schema = nullableString();

    it("accepts non-empty string", () => {
      expect(schema.parse("James")).toBe("James");
    });

    it("trims whitespace", () => {
      expect(schema.parse("  James  ")).toBe("James");
    });

    it("transforms empty string to null", () => {
      expect(schema.parse("")).toBe(null);
    });

    it("transforms whitespace-only to null", () => {
      expect(schema.parse("   ")).toBe(null);
      expect(schema.parse("\t")).toBe(null);
      expect(schema.parse("\n")).toBe(null);
    });

    it("accepts null", () => {
      expect(schema.parse(null)).toBe(null);
    });
  });

  describe("with maxLength", () => {
    const schema = nullableString(10);

    it("accepts string within limit", () => {
      expect(schema.parse("Short")).toBe("Short");
    });

    it("rejects string exceeding limit", () => {
      expect(() => schema.parse("This is way too long")).toThrow();
    });

    it("checks length after trim for padded strings", () => {
      // "  12345678  " trims to "12345678" (8 chars) — should pass if
      // maxLength is checked on trimmed value. If this fails, maxLength
      // is being checked on the untrimmed input.
      expect(schema.parse("  12345678  ")).toBe("12345678");
    });
  });
});

// =============================================================================
// requiredId
// =============================================================================
describe("requiredId", () => {
  const schema = requiredId("Please select a teacher");

  describe("valid inputs", () => {
    it("accepts positive integer", () => {
      expect(schema.parse(3)).toBe(3);
    });

    it("coerces string to number", () => {
      expect(schema.parse("3")).toBe(3);
    });

    it("accepts large IDs", () => {
      expect(schema.parse("12345")).toBe(12345);
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      expect(() => schema.parse("")).toThrow();
    });

    it("rejects whitespace-only string", () => {
      expect(() => schema.parse("   ")).toThrow();
    });

    it("rejects null", () => {
      expect(() => schema.parse(null)).toThrow();
    });

    it("rejects undefined", () => {
      expect(() => schema.parse(undefined)).toThrow();
    });

    it("rejects zero", () => {
      expect(() => schema.parse(0)).toThrow();
      expect(() => schema.parse("0")).toThrow();
    });

    it("rejects negative numbers", () => {
      expect(() => schema.parse(-1)).toThrow();
      expect(() => schema.parse("-1")).toThrow();
    });

    it("rejects non-integer decimals", () => {
      expect(() => schema.parse(3.5)).toThrow();
      expect(() => schema.parse("3.5")).toThrow();
    });

    it("rejects non-numeric strings", () => {
      expect(() => schema.parse("abc")).toThrow();
    });
  });

  describe("default error message", () => {
    it("uses 'Required' as default error", () => {
      const result = requiredId().safeParse("");
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// nullableId
// =============================================================================
describe("nullableId", () => {
  const schema = nullableId();

  describe("valid inputs", () => {
    it("accepts positive integer", () => {
      expect(schema.parse(3)).toBe(3);
    });

    it("coerces string to number", () => {
      expect(schema.parse("3")).toBe(3);
    });
  });

  describe("null conversions", () => {
    it("transforms empty string to null", () => {
      expect(schema.parse("")).toBe(null);
    });

    it("transforms whitespace-only to null", () => {
      // Whitespace means "nothing selected" — should be null, not throw.
      expect(schema.parse("   ")).toBe(null);
    });

    it("accepts null", () => {
      expect(schema.parse(null)).toBe(null);
    });

    it("transforms undefined to null", () => {
      expect(schema.parse(undefined)).toBe(null);
    });
  });

  describe("invalid inputs", () => {
    it("rejects zero (not a valid ID)", () => {
      expect(() => schema.parse(0)).toThrow();
      expect(() => schema.parse("0")).toThrow();
    });

    it("rejects negative numbers", () => {
      expect(() => schema.parse(-1)).toThrow();
    });

    it("rejects non-integer decimals", () => {
      expect(() => schema.parse(3.5)).toThrow();
    });

    it("rejects non-numeric strings", () => {
      expect(() => schema.parse("abc")).toThrow();
    });
  });
});

// =============================================================================
// booleanWithDefault
// =============================================================================
describe("booleanWithDefault", () => {
  describe("with default true", () => {
    const schema = booleanWithDefault(true);

    it("accepts true", () => {
      expect(schema.parse(true)).toBe(true);
    });

    it("accepts false", () => {
      expect(schema.parse(false)).toBe(false);
    });

    it("uses default when undefined", () => {
      expect(schema.parse(undefined)).toBe(true);
    });
  });

  describe("with default false", () => {
    const schema = booleanWithDefault(false);

    it("uses false as default", () => {
      expect(schema.parse(undefined)).toBe(false);
    });
  });

  describe("with no argument (defaults to false)", () => {
    const schema = booleanWithDefault();

    it("defaults to false", () => {
      expect(schema.parse(undefined)).toBe(false);
    });
  });
});

// =============================================================================
// nullableBoolean
// =============================================================================
describe("nullableBoolean", () => {
  const schema = nullableBoolean();

  describe("true values", () => {
    it("accepts boolean true", () => {
      expect(schema.parse(true)).toBe(true);
    });

    it("accepts string 'true'", () => {
      expect(schema.parse("true")).toBe(true);
    });
  });

  describe("false values", () => {
    it("accepts boolean false", () => {
      expect(schema.parse(false)).toBe(false);
    });

    it("accepts string 'false'", () => {
      expect(schema.parse("false")).toBe(false);
    });
  });

  describe("null values", () => {
    it("transforms empty string to null", () => {
      expect(schema.parse("")).toBe(null);
    });

    it("transforms whitespace-only to null", () => {
      expect(schema.parse("   ")).toBe(null);
    });

    it("accepts null", () => {
      expect(schema.parse(null)).toBe(null);
    });

    it("transforms undefined to null", () => {
      expect(schema.parse(undefined)).toBe(null);
    });
  });

  describe("invalid string values become null", () => {
    it("transforms invalid strings to null", () => {
      expect(schema.parse("yes")).toBe(null);
      expect(schema.parse("no")).toBe(null);
      expect(schema.parse("1")).toBe(null);
      expect(schema.parse("0")).toBe(null);
    });
  });
});

// =============================================================================
// requiredIsoDate
// =============================================================================
describe("requiredIsoDate", () => {
  const schema = requiredIsoDate("Date is required");

  describe("valid inputs", () => {
    it("accepts valid ISO date", () => {
      expect(schema.parse("1990-05-15")).toBe("1990-05-15");
    });

    it("accepts date at year boundaries", () => {
      expect(schema.parse("2000-01-01")).toBe("2000-01-01");
      expect(schema.parse("2023-12-31")).toBe("2023-12-31");
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      expect(() => schema.parse("")).toThrow();
    });

    it("rejects whitespace-only string", () => {
      expect(() => schema.parse("   ")).toThrow();
    });

    it("rejects invalid date format", () => {
      expect(() => schema.parse("05/15/1990")).toThrow();
      expect(() => schema.parse("15-05-1990")).toThrow();
      expect(() => schema.parse("1990/05/15")).toThrow();
    });

    it("rejects non-date strings", () => {
      expect(() => schema.parse("not-a-date")).toThrow();
    });
  });
});

// =============================================================================
// nullableIsoDate
// =============================================================================
describe("nullableIsoDate", () => {
  const schema = nullableIsoDate();

  describe("valid inputs", () => {
    it("accepts valid ISO date", () => {
      expect(schema.parse("1990-05-15")).toBe("1990-05-15");
    });
  });

  describe("null conversions", () => {
    it("transforms empty string to null", () => {
      expect(schema.parse("")).toBe(null);
    });

    it("transforms whitespace-only to null", () => {
      expect(schema.parse("   ")).toBe(null);
    });

    it("accepts null", () => {
      expect(schema.parse(null)).toBe(null);
    });
  });

  describe("invalid inputs", () => {
    it("rejects invalid date format", () => {
      expect(() => schema.parse("05/15/1990")).toThrow();
    });
  });
});

// =============================================================================
// requiredTime
// =============================================================================
describe("requiredTime", () => {
  const schema = requiredTime("Time is required");

  describe("valid inputs", () => {
    it("accepts valid HH:mm time", () => {
      expect(schema.parse("14:00")).toBe("14:00");
    });

    it("accepts midnight", () => {
      expect(schema.parse("00:00")).toBe("00:00");
    });

    it("accepts end of day", () => {
      expect(schema.parse("23:59")).toBe("23:59");
    });

    it("trims whitespace", () => {
      expect(schema.parse("  14:00  ")).toBe("14:00");
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      expect(() => schema.parse("")).toThrow();
    });

    it("rejects whitespace-only string", () => {
      expect(() => schema.parse("   ")).toThrow();
    });

    it("rejects invalid time formats", () => {
      expect(() => schema.parse("2:00")).toThrow(); // single digit hour
      expect(() => schema.parse("14:0")).toThrow(); // single digit minute
      expect(() => schema.parse("14:00:00")).toThrow(); // with seconds
      expect(() => schema.parse("2pm")).toThrow();
      expect(() => schema.parse("14.00")).toThrow(); // dot separator
    });

    it("uses custom error message", () => {
      const result = schema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("default error message", () => {
    it("uses 'Required' as default error", () => {
      const result = requiredTime().safeParse("");
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// nullableTime
// =============================================================================
describe("nullableTime", () => {
  const schema = nullableTime();

  describe("valid inputs", () => {
    it("accepts valid HH:mm time", () => {
      expect(schema.parse("14:00")).toBe("14:00");
    });

    it("accepts midnight", () => {
      expect(schema.parse("00:00")).toBe("00:00");
    });
  });

  describe("null conversions", () => {
    it("transforms empty string to null", () => {
      expect(schema.parse("")).toBe(null);
    });

    it("transforms whitespace-only to null", () => {
      expect(schema.parse("   ")).toBe(null);
    });

    it("accepts null", () => {
      expect(schema.parse(null)).toBe(null);
    });
  });

  describe("invalid inputs", () => {
    it("rejects invalid time format", () => {
      expect(() => schema.parse("2:00")).toThrow();
      expect(() => schema.parse("14:0")).toThrow();
      expect(() => schema.parse("2pm")).toThrow();
    });
  });
});

// =============================================================================
// requiredInt
// =============================================================================
describe("requiredInt", () => {
  const schema = requiredInt("Age is required");

  describe("valid inputs", () => {
    it("accepts positive integer", () => {
      expect(schema.parse(25)).toBe(25);
    });

    it("accepts zero", () => {
      expect(schema.parse(0)).toBe(0);
    });

    it("accepts negative integer", () => {
      expect(schema.parse(-5)).toBe(-5);
    });

    it("coerces string to number", () => {
      expect(schema.parse("25")).toBe(25);
      expect(schema.parse("0")).toBe(0);
      expect(schema.parse("-5")).toBe(-5);
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      expect(() => schema.parse("")).toThrow();
    });

    it("rejects whitespace-only string", () => {
      // Whitespace means empty field — should reject, not coerce to 0.
      // Note: Number("   ") === 0 in JS, so the preprocess must catch this.
      expect(() => schema.parse("   ")).toThrow();
    });

    it("rejects null", () => {
      expect(() => schema.parse(null)).toThrow();
    });

    it("rejects undefined", () => {
      expect(() => schema.parse(undefined)).toThrow();
    });

    it("rejects non-integer decimals", () => {
      expect(() => schema.parse(3.5)).toThrow();
      expect(() => schema.parse("3.5")).toThrow();
    });

    it("rejects non-numeric strings", () => {
      expect(() => schema.parse("abc")).toThrow();
    });
  });
});

// =============================================================================
// nullableInt
// =============================================================================
describe("nullableInt", () => {
  const schema = nullableInt();

  describe("valid inputs", () => {
    it("accepts positive integer", () => {
      expect(schema.parse(25)).toBe(25);
    });

    it("accepts zero", () => {
      expect(schema.parse(0)).toBe(0);
    });

    it("accepts negative integer", () => {
      expect(schema.parse(-5)).toBe(-5);
    });

    it("coerces string to number", () => {
      expect(schema.parse("25")).toBe(25);
    });
  });

  describe("null conversions", () => {
    it("transforms empty string to null", () => {
      expect(schema.parse("")).toBe(null);
    });

    it("transforms whitespace-only to null", () => {
      // Whitespace means empty field — should become null, not 0.
      expect(schema.parse("   ")).toBe(null);
    });

    it("accepts null", () => {
      expect(schema.parse(null)).toBe(null);
    });

    it("transforms undefined to null", () => {
      expect(schema.parse(undefined)).toBe(null);
    });
  });

  describe("invalid inputs", () => {
    it("rejects non-integer decimals", () => {
      expect(() => schema.parse(3.5)).toThrow();
    });

    it("rejects non-numeric strings", () => {
      expect(() => schema.parse("abc")).toThrow();
    });
  });
});

// =============================================================================
// requiredIdArray
// =============================================================================
describe("requiredIdArray", () => {
  const schema = requiredIdArray("Select at least one group");

  describe("valid inputs", () => {
    it("accepts array with one ID", () => {
      expect(schema.parse([1])).toEqual([1]);
    });

    it("accepts array with multiple IDs", () => {
      expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty array", () => {
      expect(() => schema.parse([])).toThrow();
    });

    it("rejects non-array input", () => {
      expect(() => schema.parse(null)).toThrow();
      expect(() => schema.parse(undefined)).toThrow();
      expect(() => schema.parse("")).toThrow();
    });

    it("rejects arrays with non-positive numbers", () => {
      expect(() => schema.parse([0])).toThrow();
      expect(() => schema.parse([-1])).toThrow();
    });

    it("rejects arrays with non-integer numbers", () => {
      expect(() => schema.parse([1.5])).toThrow();
    });
  });
});

// =============================================================================
// optionalIdArray
// =============================================================================
describe("optionalIdArray", () => {
  const schema = optionalIdArray();

  describe("valid inputs", () => {
    it("accepts array with IDs", () => {
      expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it("accepts empty array", () => {
      expect(schema.parse([])).toEqual([]);
    });
  });

  describe("default behavior", () => {
    it("defaults to empty array when undefined", () => {
      expect(schema.parse(undefined)).toEqual([]);
    });
  });
});

// =============================================================================
// Whitespace edge cases for number helpers
// =============================================================================
describe("Whitespace edge cases", () => {
  // Critical: Number("   ") === 0 in JavaScript!
  // All helpers must treat whitespace as blank, not as zero.

  describe("Number coercion with whitespace", () => {
    it("requiredId rejects whitespace (not zero)", () => {
      expect(() => requiredId().parse("   ")).toThrow();
    });

    it("nullableId converts whitespace to null (not zero)", () => {
      expect(nullableId().parse("   ")).toBe(null);
    });

    it("requiredInt rejects whitespace (not zero)", () => {
      expect(() => requiredInt().parse("   ")).toThrow();
    });

    it("nullableInt converts whitespace to null (not zero)", () => {
      expect(nullableInt().parse("   ")).toBe(null);
    });
  });
});

// =============================================================================
// Additional edge cases
// =============================================================================
describe("Additional edge cases", () => {
  describe("Infinity handling", () => {
    it("requiredInt rejects Infinity", () => {
      expect(() => requiredInt().parse(Infinity)).toThrow();
      expect(() => requiredInt().parse("Infinity")).toThrow();
    });

    it("requiredId rejects Infinity", () => {
      expect(() => requiredId().parse(Infinity)).toThrow();
    });
  });

  describe("Scientific notation", () => {
    it("requiredInt accepts scientific notation for whole numbers", () => {
      expect(requiredInt().parse("1e2")).toBe(100);
    });

    it("requiredInt rejects scientific notation for non-integers", () => {
      expect(() => requiredInt().parse("1.5e0")).toThrow();
    });
  });

  describe("Leading zeros", () => {
    it("requiredId accepts strings with leading zeros", () => {
      expect(requiredId().parse("007")).toBe(7);
    });
  });

  describe("Negative zero", () => {
    it("requiredInt accepts negative zero as zero", () => {
      const result = requiredInt().parse("-0");
      expect(result === 0).toBe(true);
    });
  });
});

// =============================================================================
// Integration - Schema composition
// =============================================================================
describe("Schema composition", () => {
  it("works in z.object for create schema", () => {
    const createSchema = z.object({
      firstName: requiredString("First name required"),
      middleName: nullableString(50),
      teacherId: requiredId("Select teacher"),
      assistantId: nullableId(),
      isActive: booleanWithDefault(true),
      agreedToTerms: nullableBoolean(),
    });

    const result = createSchema.safeParse({
      firstName: "John",
      middleName: "",
      teacherId: "3",
      assistantId: "",
      isActive: true,
      agreedToTerms: "true",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        firstName: "John",
        middleName: null,
        teacherId: 3,
        assistantId: null,
        isActive: true,
        agreedToTerms: true,
      });
    }
  });

  it("works with .partial() for update schema", () => {
    const baseSchema = z.object({
      firstName: requiredString(),
      teacherId: requiredId(),
    });
    const updateSchema = baseSchema.partial();

    const result = updateSchema.safeParse({
      firstName: "Jane",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        firstName: "Jane",
      });
    }
  });
});
