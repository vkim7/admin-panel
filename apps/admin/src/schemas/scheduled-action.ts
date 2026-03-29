import { z } from "zod";
import { requiredString, requiredIsoDate, nullableString } from "./helpers";

export const createScheduledActionSchema = z.object({
  type: z.enum(["TRANSFER", "SEND_TO_REASSIGNMENT", "SEND_TO_LOST", "MERGE_GROUP", "ASSIGN", "CHANGE_TEACHER"], {
    error: "Action type is required",
  }),
  effectiveDate: requiredIsoDate("Effective date is required"),
  studentId: z.string().optional(),
  membershipId: z.string().optional(),
  sourceGroupId: z.string().optional(),
  destinationGroupId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).transform((v) => v as Record<string, string | number | boolean | null>),
});

export type CreateScheduledActionValues = z.infer<typeof createScheduledActionSchema>;

export const cancelScheduledActionSchema = z.object({
  id: requiredString("Action ID is required"),
  cancelReason: nullableString(500),
});

export type CancelScheduledActionValues = z.infer<typeof cancelScheduledActionSchema>;
