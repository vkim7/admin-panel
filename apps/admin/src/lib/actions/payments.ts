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

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        studentId: period.studentId,
        studentPaymentPeriodId: periodId,
        amount: parsed.data.amount,
        paymentMethod: parsed.data.paymentMethod,
        note: parsed.data.note,
        recordedById: admin.id,
      },
    }),
    prisma.studentPaymentPeriod.update({
      where: { id: periodId },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: newStatus,
      },
    }),
  ]);

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
