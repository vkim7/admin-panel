import { z } from "zod";
import { requiredString, nullableString } from "./helpers";

export const markUncertainSchema = z.object({
  uncertainReasonId: requiredString("Reason is required"),
  otherReason: nullableString(500),
});

export type MarkUncertainValues = z.infer<typeof markUncertainSchema>;
