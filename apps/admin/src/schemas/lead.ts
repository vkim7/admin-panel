import { z } from "zod";
import { requiredString, nullableString } from "./helpers";
import { TIME_SLOTS } from "@/lib/constants";

export const updateLeadStatusSchema = z.object({
  id: requiredString("Lead ID is required"),
  // CONVERTED is intentionally omitted — it can only be set by createStudent
  // when a lead is converted to a student. LOST goes through markLeadLost
  // (requires reason) but is still accepted here for the legacy callsite.
  status: z.enum(["NEW", "CONTACTED", "LOST"]),
});

export const updateLeadNoteSchema = z.object({
  id: requiredString("Lead ID is required"),
  adminNote: nullableString(1000),
});

// ─── Phase 3 schemas (defined now, wired into UI in Phase 3) ──────────────────

const LEVEL_VALUES = [
  "BEGINNER",
  "ELEMENTARY",
  "PRE_INTERMEDIATE",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "IELTS",
] as const;

const DAY_PATTERN_MWF = [1, 3, 5] as const;
const DAY_PATTERN_TTS = [2, 4, 6] as const;

/** Day pattern: must be MWF or TTS. Empty array allowed (means "not captured yet"). */
const dayPattern = z.array(z.number().int().min(1).max(7)).refine(
  (days) => {
    if (days.length === 0) return true;
    const sorted = [...days].sort((a, b) => a - b).join(",");
    return (
      sorted === DAY_PATTERN_MWF.join(",") ||
      sorted === DAY_PATTERN_TTS.join(",")
    );
  },
  { error: "Days must be Mon/Wed/Fri or Tue/Thu/Sat" },
);

/** Time slot list: only values from the canonical TIME_SLOTS array. */
const timeSlots = z
  .array(z.enum(TIME_SLOTS))
  .max(5, "Pick up to 5 time slots");

export const setLeadScheduleSchema = z.object({
  id: requiredString("Lead ID is required"),
  preferredDays: dayPattern,
  preferredTimeSlots: timeSlots,
  preferredDaysAny: z.boolean(),
  preferredTimeSlotsAny: z.boolean(),
});

export const setNextCallbackSchema = z
  .object({
    id: requiredString("Lead ID is required"),
    // ISO 8601 string in UTC; client builds this from Tashkent-local quick-set buttons.
    at: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  })
  .refine((data) => new Date(data.at).getTime() > Date.now(), {
    error: "Callback time must be in the future",
    path: ["at"],
  });

export const markCallbackDoneSchema = z.object({
  id: requiredString("Lead ID is required"),
});

export const markTestSentSchema = z.object({
  id: requiredString("Lead ID is required"),
  level: z.enum(LEVEL_VALUES),
});

export const recordTestScoreSchema = z.object({
  id: requiredString("Lead ID is required"),
  score: z.coerce.number().int().min(0).max(100),
});

export const markLeadLostSchema = z
  .object({
    id: requiredString("Lead ID is required"),
    reason: z.enum([
      "NO_ANSWER",
      "WRONG_NUMBER",
      "DIDNT_SUBMIT",
      "AGE_OUT_OF_RANGE",
      "NOT_INTERESTED",
      "WANTED_OFFLINE",
      "DUPLICATE",
      "OTHER",
    ]),
    otherText: nullableString(500),
  })
  .refine(
    (data) =>
      data.reason !== "OTHER" || (data.otherText && data.otherText.length > 0),
    { error: "Please describe the reason", path: ["otherText"] },
  );

