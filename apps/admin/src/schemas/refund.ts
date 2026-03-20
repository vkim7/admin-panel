import { z } from "zod";
import { requiredString, nullableString } from "./helpers";

export const processRefundSchema = z.object({
  refundId: requiredString("Refund is required"),
  amountRefunded: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be positive"),
  paymentMethod: z.enum(["click", "payme", "cash"]),
  note: nullableString(),
});

export const convertRefundToCreditSchema = z.object({
  refundId: requiredString("Refund is required"),
  targetPeriodId: requiredString("Target period is required"),
  note: nullableString(),
});
