import { z } from "zod";
import { requiredString } from "./helpers";

export const generateTeacherPaySchema = z.object({
  year: z.coerce.number().int().min(2024).max(2030),
  month: z.coerce.number().int().min(1).max(12),
});

export const markTeacherPaidSchema = z.object({
  teacherId: requiredString(),
  year: z.coerce.number().int().min(2024).max(2030),
  month: z.coerce.number().int().min(1).max(12),
});

export const markGroupPayPaidSchema = z.object({
  id: requiredString(),
});

export const deleteTeacherPaymentSchema = z.object({
  id: requiredString(),
});
