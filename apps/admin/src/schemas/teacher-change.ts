import { z } from "zod";
import { requiredString, requiredIsoDate } from "./helpers";

export const permanentTeacherChangeSchema = z.object({
  groupId: requiredString("Group is required"),
  newTeacherId: requiredString("New teacher is required"),
  effectiveDate: requiredIsoDate("Effective date is required"),
});
