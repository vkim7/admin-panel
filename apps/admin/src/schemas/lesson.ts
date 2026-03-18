import { z } from "zod";
import { requiredString, requiredIsoDate, requiredTime } from "./helpers";

export const completeLessonSchema = z.object({
  lessonId: requiredString("Lesson ID is required"),
});

export const cancelLessonSchema = z.object({
  lessonId: requiredString("Lesson ID is required"),
  cancellationReasonId: requiredString("Cancellation reason is required"),
  otherCancellationReason: z.string().trim().nullable().optional(),
});

export const offlineRescheduleSchema = z.object({
  lessonId: requiredString("Lesson ID is required"),
  newDate: requiredIsoDate("New date is required"),
  newStartTime: requiredTime("New start time is required"),
});

export const assignSubstituteSchema = z.object({
  lessonId: requiredString("Lesson ID is required"),
  substituteTeacherId: requiredString("Substitute teacher is required"),
});

export const studentCancelLessonSchema = z.object({
  lessonId: requiredString("Lesson ID is required"),
});
