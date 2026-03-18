import { z } from "zod";
import { requiredString } from "./helpers";

export const permanentTeacherChangeSchema = z.object({
  groupId: requiredString("Group is required"),
  newTeacherId: requiredString("New teacher is required"),
});
