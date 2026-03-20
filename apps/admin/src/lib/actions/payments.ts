"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { recordPaymentSchema, adjustPeriodSchema } from "@/schemas/payment";
import { calculatePaymentStatus } from "@/lib/helpers/payment-status";

export async function recordPayment(periodId: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = recordPaymentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const period = await prisma.studentPaymentPeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      studentId: true,
      groupId: true,
      amountDue: true,
      discountAmount: true,
      amountPaid: true,
    },
  });

  if (!period) {
    return { error: "Billing period not found" };
  }

  const newAmountPaid = period.amountPaid + parsed.data.amount;
  const newStatus = calculatePaymentStatus(
    period.amountDue,
    period.discountAmount,
    newAmountPaid,
  );

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        studentId: period.studentId,
        studentPaymentPeriodId: periodId,
        amount: parsed.data.amount,
        paymentMethod: parsed.data.paymentMethod,
        note: parsed.data.note,
        recordedById: admin.id,
      },
    });

    await tx.studentPaymentPeriod.update({
      where: { id: periodId },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: newStatus,
      },
    });

    // Referral completion: when a referred student makes their first real payment
    const pendingReferral = await tx.referral.findUnique({
      where: { referredStudentId: period.studentId },
    });

    if (pendingReferral && pendingReferral.status === "PENDING") {
      // Check this is the student's first real (non-transfer-credit) payment
      const realPaymentCount = await tx.payment.count({
        where: {
          studentId: period.studentId,
          isTransferCredit: false,
        },
      });

      // realPaymentCount includes the one we just created above
      if (realPaymentCount === 1) {
        // Complete the referral
        await tx.referral.update({
          where: { id: pendingReferral.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });

        // Find referral reward promotions and create StudentPromotions
        const [referrerReward, referredReward] = await Promise.all([
          tx.promotion.findFirst({
            where: { type: "LOYALTY", isActive: true, name: { contains: "Referral Reward" } },
            select: { id: true, validityDays: true },
          }),
          tx.promotion.findFirst({
            where: { type: "LOYALTY", isActive: true, name: { contains: "Referral Welcome" } },
            select: { id: true, validityDays: true },
          }),
        ]);

        if (referrerReward) {
          const expiresAt = referrerReward.validityDays
            ? new Date(Date.now() + referrerReward.validityDays * 24 * 60 * 60 * 1000)
            : null;
          await tx.studentPromotion.create({
            data: {
              studentId: pendingReferral.referrerStudentId,
              promotionId: referrerReward.id,
              expiresAt,
            },
          });
        }

        if (referredReward) {
          const expiresAt = referredReward.validityDays
            ? new Date(Date.now() + referredReward.validityDays * 24 * 60 * 60 * 1000)
            : null;
          await tx.studentPromotion.create({
            data: {
              studentId: pendingReferral.referredStudentId,
              promotionId: referredReward.id,
              expiresAt,
            },
          });
        }
      }
    }
  });

  revalidatePath("/payments");
  revalidatePath(`/students/${period.studentId}`);
  return { success: true };
}

export async function adjustPeriod(periodId: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = adjustPeriodSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const period = await prisma.studentPaymentPeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      studentId: true,
      totalLessons: true,
      amountDue: true,
      discountAmount: true,
      amountPaid: true,
    },
  });

  if (!period) {
    return { error: "Billing period not found" };
  }

  const newStatus = calculatePaymentStatus(
    parsed.data.amountDue,
    parsed.data.discountAmount,
    period.amountPaid,
  );

  await prisma.$transaction([
    prisma.paymentPeriodAdjustment.create({
      data: {
        studentPaymentPeriodId: periodId,
        type: "MANUAL",
        previousTotalLessons: period.totalLessons,
        previousAmountDue: period.amountDue,
        previousDiscountAmount: period.discountAmount,
        newTotalLessons: parsed.data.totalLessons,
        newAmountDue: parsed.data.amountDue,
        newDiscountAmount: parsed.data.discountAmount,
        reason: parsed.data.reason,
        adjustedById: admin.id,
      },
    }),
    prisma.studentPaymentPeriod.update({
      where: { id: periodId },
      data: {
        totalLessons: parsed.data.totalLessons,
        amountDue: parsed.data.amountDue,
        discountAmount: parsed.data.discountAmount,
        paymentStatus: newStatus,
      },
    }),
  ]);

  revalidatePath("/payments");
  revalidatePath(`/students/${period.studentId}`);
  return { success: true };
}
