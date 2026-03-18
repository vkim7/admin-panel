import { z } from "zod";
import { requiredString } from "./helpers";

export const initializeAttendanceSchema = z.object({
  lessonId: requiredString("Lesson ID is required"),
});

export const toggleAttendanceSchema = z.object({
  attendanceId: requiredString("Attendance ID is required"),
  isAbsent: z.boolean(),
});
