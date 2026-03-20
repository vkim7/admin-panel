import { z } from "zod";
import { requiredString } from "./helpers";

const studentDecisionSchema = z.object({
  studentId: requiredString("Student is required"),
  decision: z.enum(["CONTINUE", "REASSIGN", "DEACTIVATE"]),
  lostReasonId: z.string().optional(),
  otherLostReason: z.string().optional(),
});

export const graduateGroupSchema = z
  .object({
    groupId: requiredString("Group is required"),
    studentDecisions: z.array(studentDecisionSchema).min(1, "At least one student decision is required"),
  })
  .refine(
    (data) =>
      data.studentDecisions.every(
        (d) => d.decision !== "DEACTIVATE" || (d.lostReasonId && d.lostReasonId.trim() !== ""),
      ),
    { message: "Deactivated students must have a lost reason" },
  );
