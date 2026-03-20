"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { processRefundSchema, convertRefundToCreditSchema } from "@/schemas/refund";
import { calculatePaymentStatus } from "@/lib/helpers/payment-status";

/**
 * Process (complete) a pending refund — record the actual amount returned.
 */
export async function processRefund(data: unknown) {
  const admin = await requireAdmin();
  const parsed = processRefundSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { refundId, amountRefunded, paymentMethod, note } = parsed.data;

  const refund = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!refund) return { error: "Refund not found" };
  if (refund.status !== "PENDING") return { error: "Refund is already processed" };

  await prisma.refund.update({
    where: { id: refundId },
    data: {
      status: "COMPLETED",
      amountRefunded,
      paymentMethod,
      note,
      processedById: admin.id,
      processedAt: new Date(),
    },
  });

  revalidatePath("/refunds");
  revalidatePath(`/students/${refund.studentId}`);

  return { success: true };
}

/**
 * Convert a pending refund to credit on a target billing period.
 * Creates a Payment with isTransferCredit, updates the period, marks refund completed.
 */
export async function convertRefundToCredit(data: unknown) {
  const admin = await requireAdmin();
  const parsed = convertRefundToCreditSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { refundId, targetPeriodId, note } = parsed.data;

  const refund = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!refund) return { error: "Refund not found" };
  if (refund.status !== "PENDING") return { error: "Refund is already processed" };

  const period = await prisma.studentPaymentPeriod.findUnique({
    where: { id: targetPeriodId },
  });
  if (!period) return { error: "Target period not found" };
  if (period.studentId !== refund.studentId) {
    return { error: "Period does not belong to this student" };
  }

  await prisma.$transaction(async (tx) => {
    // Create payment as transfer credit
    await tx.payment.create({
      data: {
        studentId: refund.studentId,
        studentPaymentPeriodId: targetPeriodId,
        amount: refund.amount,
        isTransferCredit: true,
        note: note ?? `Converted from refund`,
        recordedById: admin.id,
      },
    });

    // Update period
    const newAmountPaid = period.amountPaid + refund.amount;
    const newStatus = calculatePaymentStatus(
      period.amountDue,
      period.discountAmount,
      newAmountPaid,
    );

    await tx.studentPaymentPeriod.update({
      where: { id: targetPeriodId },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: newStatus,
      },
    });

    // Mark refund completed with amountRefunded = 0 (money went to credit, not returned)
    await tx.refund.update({
      where: { id: refundId },
      data: {
        status: "COMPLETED",
        amountRefunded: 0,
        note: note ?? `Converted to credit on period ${period.periodYear}-${String(period.periodMonth).padStart(2, "0")}`,
        processedById: admin.id,
        processedAt: new Date(),
      },
    });
  });

  revalidatePath("/refunds");
  revalidatePath("/payments");
  revalidatePath(`/students/${refund.studentId}`);

  return { success: true };
}

/**
 * Get student's UNPAID/PARTIALLY_PAID periods for the convert-to-credit period picker.
 */
export async function getStudentPeriodsForCredit(refundId: string) {
  await requireAdmin();

  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    select: { studentId: true },
  });

  if (!refund) return [];

  return prisma.studentPaymentPeriod.findMany({
    where: {
      studentId: refund.studentId,
      paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
    },
    select: {
      id: true,
      periodYear: true,
      periodMonth: true,
      amountDue: true,
      discountAmount: true,
      amountPaid: true,
      group: { select: { publicId: true } },
    },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
  });
}
