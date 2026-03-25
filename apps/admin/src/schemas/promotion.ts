import { z } from "zod";
import {
  requiredString,
  nullableString,
  nullableInt,
  nullableIsoDate,
  booleanWithDefault,
} from "./helpers";

/** Nullable int for forms — avoids preprocess so zodResolver types work correctly */
const formNullableInt = () => z.number().int().nullable();

const LEVELS = [
  "BEGINNER",
  "ELEMENTARY",
  "PRE_INTERMEDIATE",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "IELTS",
] as const;

const GROUP_TYPES = ["GROUP", "INDIVIDUAL"] as const;

const PROMOTION_TYPES = [
  "SEASONAL",
  "FAMILY",
  "REFERRAL",
  "WIN_BACK",
  "TRIAL",
  "PROMO_CODE",
  "APOLOGY",
  "REWARD",
] as const;

const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;

// Base schema — used by react-hook-form resolver (no refine, no preprocess, no default)
export const promotionBaseSchema = z.object({
  name: requiredString("Name is required"),
  type: z.enum(PROMOTION_TYPES, { error: "Type is required" }),
  discountType: z.enum(DISCOUNT_TYPES, { error: "Discount type is required" }),
  discountPercent: formNullableInt(),
  discountAmount: formNullableInt(),
  levels: z.array(z.enum(LEVELS)),
  groupTypes: z.array(z.enum(GROUP_TYPES)),
  isRecurring: z.boolean(),
  recurringMonths: formNullableInt(),
  maxUsesPerStudent: formNullableInt(),
  maxUsesTotal: formNullableInt(),
  validityDays: formNullableInt(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  code: z.string().nullable(),
  isActive: z.boolean(),
});

export type PromotionFormValues = z.infer<typeof promotionBaseSchema>;

// Full schema with refine — used in server actions
export const promotionSchema = promotionBaseSchema.refine(
  (data) => {
    if (data.discountType === "PERCENTAGE") {
      return data.discountPercent != null && data.discountPercent > 0 && data.discountPercent <= 100;
    }
    return data.discountAmount != null && data.discountAmount > 0;
  },
  {
    message: "PERCENTAGE requires discountPercent (1-100), FIXED_AMOUNT requires discountAmount",
    path: ["discountPercent"],
  },
);

export const assignPromotionSchema = z.object({
  studentId: requiredString("Student is required"),
  promotionId: requiredString("Promotion is required"),
  comment: requiredString("Comment is required").max(500, "Comment must be 500 characters or fewer"),
});

export type AssignPromotionValues = z.infer<typeof assignPromotionSchema>;

export const referralSchema = z
  .object({
    referrerStudentId: requiredString("Referrer is required"),
    referredStudentId: requiredString("Referred student is required"),
  })
  .refine(
    (data) => data.referrerStudentId !== data.referredStudentId,
    { message: "A student cannot refer themselves", path: ["referredStudentId"] },
  );

export type ReferralFormValues = z.infer<typeof referralSchema>;
