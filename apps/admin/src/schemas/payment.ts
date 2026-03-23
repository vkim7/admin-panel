import { z } from "zod";
import { nullableString } from "./helpers";

export const recordPaymentSchema = z.object({
  amount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be positive"),
  paymentMethod: z.enum(["click", "payme", "cash", "bank_transfer"]),
  note: nullableString(),
});

export const adjustPeriodSchema = z.object({
  totalLessons: z.coerce
    .number()
    .int("Must be a whole number")
    .nonnegative("Cannot be negative"),
  amountDue: z.coerce
    .number()
    .int("Must be a whole number")
    .nonnegative("Cannot be negative"),
  discountAmount: z.coerce
    .number()
    .int("Must be a whole number")
    .nonnegative("Cannot be negative"),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required for manual adjustments"),
});
