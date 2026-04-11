import { z } from "zod";
import { requiredString, nullableString } from "./helpers";

export const createExcusedAbsenceSchema = z.object({
  studentId: requiredString("Student is required"),
  lessonId: requiredString("Lesson is required"),
  groupMembershipId: requiredString("Membership is required"),
  reasonId: requiredString("Reason is required"),
  otherReason: nullableString(500),
  note: nullableString(1000),
});

export const deleteExcusedAbsenceSchema = z.object({
  id: requiredString("Excused absence ID is required"),
});
