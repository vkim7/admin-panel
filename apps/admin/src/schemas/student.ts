import { z } from "zod";
import { requiredString, requiredPhone, nullableString, requiredIsoDate } from "./helpers";
import { TIME_SLOTS } from "@/lib/constants";

const LEVELS = [
  "BEGINNER",
  "ELEMENTARY",
  "PRE_INTERMEDIATE",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "IELTS",
] as const;

const PREFERRED_LANGUAGES = ["UZBEK", "RUSSIAN", "ANY"] as const;

const PROGRESS_STAGES = ["BEGINNING", "MID", "FINAL"] as const;

// Base schema — used by react-hook-form resolver (no transforms/preprocess)
export const studentBaseSchema = z.object({
  firstName: requiredString("First name is required"),
  lastName: requiredString("Last name is required"),
  phone: requiredPhone(),
  dateOfBirth: requiredIsoDate("Date of birth is required"),
  level: z.enum(LEVELS, { error: "Level is required" }),
  progressStage: z.enum(PROGRESS_STAGES, { error: "Progress stage is required" }),
  preferredDays: z.array(z.number().int().min(1).max(7)),
  preferredTimeSlots: z.array(z.string()),
  preferredLanguage: z.enum(PREFERRED_LANGUAGES, { error: "Language preference is required" }),
  familyId: z.string().nullable(),
  comment: z.string().nullable(),
  promoCode: z.string().nullable(),
  referredByCode: z.string().nullable(),
});

export type StudentFormValues = z.infer<typeof studentBaseSchema>;

// Full schema with transforms + C#7 refine — used in server actions
export const studentSchema = z
  .object({
    firstName: requiredString("First name is required"),
    lastName: requiredString("Last name is required"),
    phone: requiredPhone(),
    dateOfBirth: requiredIsoDate("Date of birth is required"),
    level: z.enum(LEVELS, { error: "Level is required" }),
    progressStage: z.enum(PROGRESS_STAGES, { error: "Progress stage is required" }),
    preferredDays: z.array(z.number().int().min(1).max(7)),
    preferredTimeSlots: z.array(z.enum(TIME_SLOTS)),
    preferredLanguage: z.enum(PREFERRED_LANGUAGES, { error: "Language preference is required" }),
    familyId: nullableString(),
    comment: nullableString(500),
    promoCode: nullableString(),
    referredByCode: nullableString(),
  })
  .refine(
    (data) => {
      // Promo code and referral code are mutually exclusive
      if (data.promoCode && data.referredByCode) return false;
      return true;
    },
    {
      message: "Promo code and referral code are mutually exclusive — use one or the other",
      path: ["referredByCode"],
    },
  )
  .refine(
    (data) => {
      // C#7: Minor enrollment requires familyId
      const dob = new Date(data.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 18 && !data.familyId) {
        return false;
      }
      return true;
    },
    {
      message: "Students under 18 must be linked to a family",
      path: ["familyId"],
    },
  );

export const sendOrphanToLostSchema = z.object({
  lostReasonId: requiredString("Lost reason is required"),
  otherLostReason: z.string().nullable(),
});

export type SendOrphanToLostValues = z.infer<typeof sendOrphanToLostSchema>;

export const sendToLostSchema = z.object({
  lostReasonId: requiredString("Lost reason is required"),
  otherLostReason: z.string().nullable(),
  effectiveDate: requiredIsoDate("Effective date is required"),
});

export type SendToLostValues = z.infer<typeof sendToLostSchema>;
