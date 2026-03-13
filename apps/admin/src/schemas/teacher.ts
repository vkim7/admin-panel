import { z } from "zod";
import { requiredString, requiredPhone, requiredTime, requiredInt } from "./helpers";

const LEVELS = [
  "BEGINNER",
  "ELEMENTARY",
  "PRE_INTERMEDIATE",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "IELTS",
] as const;

export const teacherSchema = z.object({
  firstName: requiredString("First name is required"),
  lastName: requiredString("Last name is required"),
  phone: requiredPhone(),
  levels: z.array(z.enum(LEVELS)).min(1, "Select at least one level"),
  canTeachUzbek: z.boolean(),
  canTeachRussian: z.boolean(),
  canTeachEnglishOnly: z.boolean(),
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

export const rateChangeSchema = z.object({
  groupLessonRate: requiredInt("Group rate is required"),
  individualLessonRate: requiredInt("Individual rate is required"),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .refine(
      (val) => {
        const day = parseInt(val.split("-")[2] ?? "0", 10);
        return day === 1;
      },
      { message: "Must be the first of the month" },
    ),
});

export type RateChangeFormValues = z.infer<typeof rateChangeSchema>;
