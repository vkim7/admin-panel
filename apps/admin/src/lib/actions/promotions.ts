"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { promotionSchema, assignPromotionSchema } from "@/schemas/promotion";

export async function createPromotion(data: unknown) {
  await requireAdmin();
  const parsed = promotionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { validFrom, validTo, ...rest } = parsed.data;

  try {
    await prisma.promotion.create({
      data: {
        ...rest,
        validFrom: validFrom ? new Date(validFrom + "T00:00:00Z") : null,
        validTo: validTo ? new Date(validTo + "T23:59:59Z") : null,
      },
    });
    redirect("/promotions");
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A promotion with this code already exists" };
    }
    throw e;
  }
}

export async function updatePromotion(id: string, data: unknown) {
  await requireAdmin();
  const parsed = promotionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { validFrom, validTo, ...rest } = parsed.data;

  try {
    await prisma.promotion.update({
      where: { id },
      data: {
        ...rest,
        validFrom: validFrom ? new Date(validFrom + "T00:00:00Z") : null,
        validTo: validTo ? new Date(validTo + "T23:59:59Z") : null,
      },
    });
    revalidatePath("/promotions");
    redirect(`/promotions/${id}/edit`);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A promotion with this code already exists" };
    }
    throw e;
  }
}

export async function togglePromotionActive(id: string) {
  await requireAdmin();

  const promotion = await prisma.promotion.findUnique({
    where: { id },
    select: { isActive: true },
  });

  if (!promotion) {
    return { error: "Promotion not found" };
  }

  await prisma.promotion.update({
    where: { id },
    data: { isActive: !promotion.isActive },
  });

  revalidatePath("/promotions");
  return { success: true };
}

export async function assignPromotionToStudent(data: unknown) {
  const admin = await requireAdmin();
  const parsed = assignPromotionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const promotion = await prisma.promotion.findUnique({
    where: { id: parsed.data.promotionId },
    select: { type: true, validityDays: true, isActive: true },
  });

  if (!promotion) {
    return { error: "Promotion not found" };
  }

  if (!promotion.isActive) {
    return { error: "Promotion is not active" };
  }

  if (promotion.type !== "APOLOGY" && promotion.type !== "REWARD") {
    return { error: "Only Apology and Reward promotions can be manually assigned" };
  }

  const expiresAt = promotion.validityDays
    ? new Date(Date.now() + promotion.validityDays * 24 * 60 * 60 * 1000)
    : null;

  await prisma.studentPromotion.create({
    data: {
      studentId: parsed.data.studentId,
      promotionId: parsed.data.promotionId,
      comment: parsed.data.comment,
      expiresAt,
    },
  });

  revalidatePath(`/students/${parsed.data.studentId}`);
  return { success: true };
}
