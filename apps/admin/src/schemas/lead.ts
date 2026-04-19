import { z } from "zod";
import { requiredString, nullableString } from "./helpers";

export const updateLeadStatusSchema = z.object({
  id: requiredString("Lead ID is required"),
  status: z.enum(["NEW", "CONTACTED", "TRIAL_SCHEDULED", "CONVERTED", "LOST"]),
});

export const updateLeadNoteSchema = z.object({
  id: requiredString("Lead ID is required"),
  adminNote: nullableString(1000),
});
