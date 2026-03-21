import { z } from "zod";
import { requiredString, requiredIsoDate, nullableString } from "./helpers";

export const addStudentsSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "Select at least one student"),
  joinDate: requiredIsoDate("Join date is required"),
  comment: nullableString(500),
});

export type AddStudentsValues = z.infer<typeof addStudentsSchema>;

// Base schema for react-hook-form (no transforms)
export const addStudentsBaseSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "Select at least one student"),
  joinDate: z.string().min(1, "Join date is required"),
  comment: z.string().nullable(),
});

export type AddStudentsFormValues = z.infer<typeof addStudentsBaseSchema>;

export const trialResolutionSchema = z.object({
  action: z.enum(["commit", "didnt_continue"]),
});

export type TrialResolutionValues = z.infer<typeof trialResolutionSchema>;
