import { z } from "zod";
import { requiredString, requiredPhone, nullableString, requiredTime, requiredInt } from "./helpers";

const LEVELS = [
  "BEGINNER",
  "ELEMENTARY",
  "PRE_INTERMEDIATE",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "IELTS",
] as const;

const TEACHING_LANGUAGES = ["UZBEK", "RUSSIAN", "ANY"] as const;

export const teacherSchema = z.object({
  firstName: requiredString("First name is required"),
  lastName: requiredString("Last name is required"),
  phone: requiredPhone(),
  pinfl: z
    .string()
    .trim()
    .min(1, { message: "PINFL is required" })
    .regex(/^\d{14}$/, { message: "PINFL must be exactly 14 digits" }),
  zoomEmail: nullableString(),
  levels: z.array(z.enum(LEVELS)).min(1, "Select at least one level"),
  teachingLanguage: z.enum(TEACHING_LANGUAGES, { error: "Teaching language is required" }),
});

export type TeacherFormValues = z.infer<typeof teacherSchema>;

export const availabilityBlockSchema = z
  .object({
    dayOfWeek: z.number().int().min(1).max(7),
    startTime: requiredTime("Start time is required"),
    endTime: requiredTime("End time is required"),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export type AvailabilityBlockValues = z.infer<typeof availabilityBlockSchema>;

const effectiveFromField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be DD.MM.YYYY")
  .refine(
    (val) => {
      const day = parseInt(val.split("-")[2] ?? "0", 10);
      return day === 1;
    },
    { message: "Must be the first of the month" },
  );

export const rateChangeSchema = z
  .object({
    groupLessonRate: requiredInt("Group rate is required"),
    individualLessonRate: requiredInt("Individual rate is required"),
    effectiveFrom: effectiveFromField,
  })
  .refine((d) => d.groupLessonRate >= 1, {
    message: "Group rate must be at least 1",
    path: ["groupLessonRate"],
  })
  .refine((d) => d.individualLessonRate >= 1, {
    message: "Individual rate must be at least 1",
    path: ["individualLessonRate"],
  });

export type RateChangeFormValues = z.infer<typeof rateChangeSchema>;

export const updateRateChangeSchema = z
  .object({
    id: requiredString("Rate change ID is required"),
    groupLessonRate: requiredInt("Group rate is required"),
    individualLessonRate: requiredInt("Individual rate is required"),
    effectiveFrom: effectiveFromField,
  })
  .refine((d) => d.groupLessonRate >= 1, {
    message: "Group rate must be at least 1",
    path: ["groupLessonRate"],
  })
  .refine((d) => d.individualLessonRate >= 1, {
    message: "Individual rate must be at least 1",
    path: ["individualLessonRate"],
  });

export type UpdateRateChangeFormValues = z.infer<typeof updateRateChangeSchema>;
