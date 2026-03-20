import { z } from "zod";
import { requiredString } from "./helpers";

export const mergeGroupSchema = z.object({
  sourceGroupId: requiredString("Source group is required"),
  destinationGroupId: requiredString("Destination group is required"),
});
