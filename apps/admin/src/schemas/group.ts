import { z } from "zod";
import {
  requiredString,
  requiredTime,
  requiredIsoDate,
  requiredInt,
  nullableString,
} from "./helpers";

const LEVELS = [
  "BEGINNER",
  "ELEMENTARY",
  "PRE_INTERMEDIATE",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "IELTS",
] as const;

const GROUP_TYPES = ["GROUP", "INDIVIDUAL"] as const;

const VALID_DAY_PATTERNS = [
  [1, 3, 5],
  [2, 4, 6],
];

// Base schema — used by react-hook-form resolver (no transforms)
export const groupBaseSchema = z.object({
  type: z.enum(GROUP_TYPES),
  teacherId: requiredString("Teacher is required"),
  days: z.array(z.number().int().min(1).max(7)),
  startTime: z.string().min(1, "Start time is required"),
  level: z.enum(LEVELS, { error: "Level is required" }),
  durationMinutes: z.number().int(),
  maxStudents: z.number().int().min(1),
  startDate: z.string().min(1, "Start date is required"),
  zoomLink: z.string().nullable(),
});

export type GroupFormValues = z.infer<typeof groupBaseSchema>;

// Create schema — used in server action (with transforms + refines)
export const groupCreateSchema = z
  .object({
    type: z.enum(GROUP_TYPES),
    teacherId: requiredString("Teacher is required"),
    days: z.array(z.number().int().min(1).max(7)).min(1, "Days are required"),
    startTime: requiredTime("Start time is required"),
    level: z.enum(LEVELS, { error: "Level is required" }),
    durationMinutes: requiredInt("Duration is required"),
    maxStudents: requiredInt("Max students is required"),
    startDate: requiredIsoDate("Start date is required"),
    zoomLink: nullableString(),
  })
  .refine(
    (data) => {
      // C#12: Only [1,3,5] or [2,4,6] allowed
      const sorted = [...data.days].sort();
      return VALID_DAY_PATTERNS.some(
        (p) =>
          p.length === sorted.length && p.every((v, i) => v === sorted[i]),
      );
    },
    { message: "Days must be Mon/Wed/Fri or Tue/Thu/Sat", path: ["days"] },
  )
  .refine(
    (data) => {
      // C#12a: Only 60 or 80
      return data.durationMinutes === 60 || data.durationMinutes === 80;
    },
    { message: "Duration must be 60 or 80 minutes", path: ["durationMinutes"] },
  );

// Edit schema — level/progressStage/days/type/startDate not editable
export const groupEditSchema = z.object({
  maxStudents: requiredInt("Max students is required"),
  startTime: requiredTime("Start time is required"),
  zoomLink: nullableString(),
  skipAutoGraduation: z.boolean().default(false),
});

export type GroupEditValues = z.infer<typeof groupEditSchema>;
