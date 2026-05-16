import { z } from "zod";
import { requiredString } from "./helpers";

export const GROUP_CLOSED_REASONS = [
  "STUDENTS_LEFT",
  "LOW_ENROLLMENT",
  "ADMIN_ERROR",
  "OTHER",
] as const;

export const closeGroupSchema = z.object({
  groupId: requiredString("Group is required"),
  reason: z.enum(GROUP_CLOSED_REASONS),
});

export type CloseGroupInput = z.infer<typeof closeGroupSchema>;
