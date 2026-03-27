import { z } from "zod";
import { requiredString, requiredIsoDate } from "./helpers";

export const mergeGroupSchema = z.object({
  sourceGroupId: requiredString("Source group is required"),
  destinationGroupId: requiredString("Destination group is required"),
  effectiveDate: requiredIsoDate("Effective date is required"),
});
