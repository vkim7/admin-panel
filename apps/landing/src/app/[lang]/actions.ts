"use server";

import { z } from "zod";
import { prisma } from "@/server/db";

const leadSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+998\d{9}$/, "Invalid phone number"),
  dateOfBirth: z.preprocess(
    (val) =>
      typeof val === "string" && val.trim() !== "" ? new Date(val) : null,
    z.date().nullable(),
  ),
  lessonPreference: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.enum(["GROUP", "PAIR", "INDIVIDUAL"]).nullable(),
  ),
  selfAssessedLevel: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z
      .enum(["COMPLETE_BEGINNER", "KNOW_A_LITTLE", "CAN_HOLD_CONVERSATION"])
      .nullable(),
  ),
  note: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.string().max(500).nullable(),
  ),
  language: z.enum(["uz", "ru"]),
});

export async function submitLead(
  _prev: { success?: boolean; error?: string } | null,
  formData: FormData,
) {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    dateOfBirth: formData.get("dateOfBirth"),
    lessonPreference: formData.get("lessonPreference"),
    selfAssessedLevel: formData.get("selfAssessedLevel"),
    note: formData.get("note"),
    language: formData.get("language"),
  };

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  await prisma.lead.create({ data: parsed.data });
  return { success: true };
}
