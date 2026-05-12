import { z } from "zod";
import { requiredString, nullableString } from "./helpers";

export const updateLeadStatusSchema = z.object({
  id: requiredString("Lead ID is required"),
  // CONVERTED is intentionally omitted — it can only be set by createStudent
  // when a lead is converted to a student. Manual writes are rejected here.
  status: z.enum(["NEW", "CONTACTED", "LOST"]),
});

export const updateLeadNoteSchema = z.object({
  id: requiredString("Lead ID is required"),
  adminNote: nullableString(1000),
});
