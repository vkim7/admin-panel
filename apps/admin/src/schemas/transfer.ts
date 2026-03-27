import { z } from "zod";
import { requiredString, requiredIsoDate, nullableString } from "./helpers";

export const transferStudentSchema = z.object({
  membershipId: requiredString("Membership is required"),
  destinationGroupId: requiredString("Destination group is required"),
  transferReasonId: requiredString("Transfer reason is required"),
  otherTransferReason: nullableString(500),
  effectiveDate: requiredIsoDate("Effective date is required"),
});
