import type { PrismaClient } from "@eng/database";
import { recalculateDiscount } from "@/lib/helpers/leave-billing";
import { calculatePaymentStatus } from "@/lib/helpers/payment-status";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface ExcusedAbsenceBillingResult {
  periodAdjusted: boolean;
  previousAmountDue: number;
  newAmountDue: number;
  overpayment: number;
}

/**
 * Adjust billing when an excused absence is recorded.
 * Reduces totalLessons by 1 on the affected billing period.
 * Mirrors the holiday-billing pattern.
 */
export async function adjustBillingForExcusedAbsence({
  groupMembershipId,
  lessonDate,
  adminId,
  tx,
}: {
  groupMembershipId: string;
  lessonDate: Date;
  adminId: string;
  tx: TxClient;
}): Promise<ExcusedAbsenceBillingResult> {
  const lessonYear = lessonDate.getUTCFullYear();
  const lessonMonth = lessonDate.getUTCMonth() + 1;

  const period = await tx.studentPaymentPeriod.findUnique({
    where: {
      groupMembershipId_periodYear_periodMonth: {
        groupMembershipId,
        periodYear: lessonYear,
        periodMonth: lessonMonth,
      },
    },
  });

  if (!period) {
    return {
      periodAdjusted: false,
      previousAmountDue: 0,
      newAmountDue: 0,
      overpayment: 0,
    };
  }

  const newTotalLessons = Math.max(0, period.totalLessons - 1);
  const newAmountDue = newTotalLessons * period.pricePerLesson;

  const newDiscountAmount = await recalculateDiscount(
    period.id,
    newAmountDue,
    period.pricePerLesson,
    tx,
  );

  const newStatus = calculatePaymentStatus(
    newAmountDue,
    newDiscountAmount,
    period.amountPaid,
  );

  await tx.paymentPeriodAdjustment.create({
    data: {
      studentPaymentPeriodId: period.id,
      type: "EXCUSED_ABSENCE",
      previousTotalLessons: period.totalLessons,
      previousAmountDue: period.amountDue,
      previousDiscountAmount: period.discountAmount,
      newTotalLessons,
      newAmountDue,
      newDiscountAmount,
      adjustedById: adminId,
    },
  });

  await tx.studentPaymentPeriod.update({
    where: { id: period.id },
    data: {
      totalLessons: newTotalLessons,
      amountDue: newAmountDue,
      discountAmount: newDiscountAmount,
      paymentStatus: newStatus,
    },
  });

  // Check for overpayment
  const effectiveDue = Math.max(0, newAmountDue - newDiscountAmount);
  const overpayment = Math.max(0, period.amountPaid - effectiveDue);

  if (overpayment > 0) {
    const nextPeriod = await tx.studentPaymentPeriod.findFirst({
      where: {
        groupMembershipId,
        OR: [
          { periodYear: lessonYear, periodMonth: { gt: lessonMonth } },
          { periodYear: { gt: lessonYear } },
        ],
      },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });

    const membership = await tx.groupMembership.findUniqueOrThrow({
      where: { id: groupMembershipId },
      select: { studentId: true },
    });

    if (nextPeriod) {
      const newAmountPaid = nextPeriod.amountPaid + overpayment;
      const creditStatus = calculatePaymentStatus(
        nextPeriod.amountDue,
        nextPeriod.discountAmount,
        newAmountPaid,
      );

      await tx.payment.create({
        data: {
          studentId: membership.studentId,
          studentPaymentPeriodId: nextPeriod.id,
          amount: overpayment,
          isTransferCredit: true,
          note: "Excused absence credit adjustment",
          recordedById: adminId,
        },
      });

      await tx.studentPaymentPeriod.update({
        where: { id: nextPeriod.id },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus: creditStatus,
        },
      });
    } else {
      await tx.refund.create({
        data: {
          studentId: membership.studentId,
          studentPaymentPeriodId: period.id,
          amount: overpayment,
          status: "PENDING",
          initiatedById: adminId,
          note: "Excused absence billing adjustment — no future period for credit",
        },
      });
    }
  }

  return {
    periodAdjusted: true,
    previousAmountDue: period.amountDue,
    newAmountDue,
    overpayment,
  };
}

/**
 * Reverse the billing adjustment when an excused absence is deleted.
 * Increases totalLessons by 1 on the affected billing period.
 * Also reverses any transfer credit or PENDING refund created by the original adjustment.
 */
export async function reverseBillingForExcusedAbsence({
  groupMembershipId,
  lessonDate,
  adminId,
  tx,
}: {
  groupMembershipId: string;
  lessonDate: Date;
  adminId: string;
  tx: TxClient;
}): Promise<void> {
  const lessonYear = lessonDate.getUTCFullYear();
  const lessonMonth = lessonDate.getUTCMonth() + 1;

  const period = await tx.studentPaymentPeriod.findUnique({
    where: {
      groupMembershipId_periodYear_periodMonth: {
        groupMembershipId,
        periodYear: lessonYear,
        periodMonth: lessonMonth,
      },
    },
  });

  if (!period) return;

  // Reverse overpayment credit/refund BEFORE restoring the period
  const currentEffectiveDue = Math.max(0, period.amountDue - period.discountAmount);
  const overpayment = Math.max(0, period.amountPaid - currentEffectiveDue);

  if (overpayment > 0) {
    const membership = await tx.groupMembership.findUniqueOrThrow({
      where: { id: groupMembershipId },
      select: { studentId: true },
    });

    // Try to find and reverse the transfer credit on the next period
    const creditPayment = await tx.payment.findFirst({
      where: {
        studentId: membership.studentId,
        isTransferCredit: true,
        note: "Excused absence credit adjustment",
        amount: overpayment,
      },
      orderBy: { paidAt: "desc" },
    });

    if (creditPayment && creditPayment.studentPaymentPeriodId) {
      const nextPeriod = await tx.studentPaymentPeriod.findUnique({
        where: { id: creditPayment.studentPaymentPeriodId },
      });

      if (nextPeriod) {
        const restoredAmountPaid = Math.max(0, nextPeriod.amountPaid - overpayment);
        await tx.studentPaymentPeriod.update({
          where: { id: nextPeriod.id },
          data: {
            amountPaid: restoredAmountPaid,
            paymentStatus: calculatePaymentStatus(
              nextPeriod.amountDue,
              nextPeriod.discountAmount,
              restoredAmountPaid,
            ),
          },
        });
      }

      await tx.payment.delete({ where: { id: creditPayment.id } });
    } else {
      // Try to find and delete PENDING refund
      const pendingRefund = await tx.refund.findFirst({
        where: {
          studentPaymentPeriodId: period.id,
          status: "PENDING",
          amount: overpayment,
          note: { contains: "Excused absence" },
        },
        orderBy: { createdAt: "desc" },
      });

      if (pendingRefund) {
        await tx.refund.delete({ where: { id: pendingRefund.id } });
      }
    }
  }

  // Now restore the period
  const newTotalLessons = period.totalLessons + 1;
  const newAmountDue = newTotalLessons * period.pricePerLesson;

  const newDiscountAmount = await recalculateDiscount(
    period.id,
    newAmountDue,
    period.pricePerLesson,
    tx,
  );

  const newStatus = calculatePaymentStatus(
    newAmountDue,
    newDiscountAmount,
    period.amountPaid,
  );

  await tx.paymentPeriodAdjustment.create({
    data: {
      studentPaymentPeriodId: period.id,
      type: "EXCUSED_ABSENCE",
      previousTotalLessons: period.totalLessons,
      previousAmountDue: period.amountDue,
      previousDiscountAmount: period.discountAmount,
      newTotalLessons,
      newAmountDue,
      newDiscountAmount,
      reason: "Excused absence removed (reversal)",
      adjustedById: adminId,
    },
  });

  await tx.studentPaymentPeriod.update({
    where: { id: period.id },
    data: {
      totalLessons: newTotalLessons,
      amountDue: newAmountDue,
      discountAmount: newDiscountAmount,
      paymentStatus: newStatus,
    },
  });
}
