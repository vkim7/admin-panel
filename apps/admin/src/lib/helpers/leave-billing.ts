import type { PrismaClient } from "@eng/database";
import { calculatePaymentStatus } from "@/lib/helpers/payment-status";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface LeaveBillingResult {
  overpayment: number;
  adjustedPeriodId: string | null;
  futurePeriodsDeleted: number;
}

/**
 * C#31: Per-membership leave billing.
 *
 * Adjusts billing when a membership ends mid-program:
 * 1. Current-month period: reduce totalLessons to lessons up to leaveDate, recalc amountDue
 * 2. Future-month periods: delete AppliedPromotion records first, then hard-delete periods
 * 3. Calculate overpayment for transfer credit or refund
 *
 * @param adjustmentType - what triggered this (TRANSFER, MERGE, DROPOUT)
 */
export async function performLeaveBilling({
  membershipId,
  leaveDate,
  adjustmentType,
  adminId,
  tx,
}: {
  membershipId: string;
  leaveDate: Date;
  adjustmentType: "TRANSFER" | "MERGE" | "DROPOUT";
  adminId: string;
  tx: TxClient;
}): Promise<LeaveBillingResult> {
  const leaveYear = leaveDate.getUTCFullYear();
  const leaveMonth = leaveDate.getUTCMonth() + 1; // 1-indexed

  // Fetch membership joinDate for lesson counting
  const membership = await tx.groupMembership.findUniqueOrThrow({
    where: { id: membershipId },
    select: { joinDate: true },
  });

  // Fetch all billing periods for this membership
  const periods = await tx.studentPaymentPeriod.findMany({
    where: { groupMembershipId: membershipId },
    include: {
      group: {
        select: {
          lessons: {
            where: { originalLessonId: null },
            select: { lessonDate: true, status: true },
          },
        },
      },
    },
  });

  let adjustedPeriodId: string | null = null;
  let overpayment = 0;

  // Find current-month period
  const currentPeriod = periods.find(
    (p) => p.periodYear === leaveYear && p.periodMonth === leaveMonth,
  );

  if (currentPeriod) {
    // Count group lessons in current month between joinDate and leaveDate (non-cancelled, original only)
    const lessonsUpToLeave = currentPeriod.group.lessons.filter((l) => {
      const lessonYear = l.lessonDate.getUTCFullYear();
      const lessonMonth = l.lessonDate.getUTCMonth() + 1;
      return (
        lessonYear === leaveYear &&
        lessonMonth === leaveMonth &&
        l.lessonDate >= membership.joinDate &&
        l.lessonDate <= leaveDate &&
        l.status !== "CANCELLED"
      );
    }).length;

    const newTotalLessons = lessonsUpToLeave;
    const newAmountDue = newTotalLessons * currentPeriod.pricePerLesson;
    const newStatus = calculatePaymentStatus(
      newAmountDue,
      currentPeriod.discountAmount,
      currentPeriod.amountPaid,
    );

    // Create audit record
    await tx.paymentPeriodAdjustment.create({
      data: {
        studentPaymentPeriodId: currentPeriod.id,
        type: adjustmentType,
        previousTotalLessons: currentPeriod.totalLessons,
        previousAmountDue: currentPeriod.amountDue,
        previousDiscountAmount: currentPeriod.discountAmount,
        newTotalLessons,
        newAmountDue,
        newDiscountAmount: currentPeriod.discountAmount,
        adjustedById: adminId,
      },
    });

    // Update the period
    await tx.studentPaymentPeriod.update({
      where: { id: currentPeriod.id },
      data: {
        totalLessons: newTotalLessons,
        amountDue: newAmountDue,
        paymentStatus: newStatus,
        isPartialPeriod: true,
      },
    });

    adjustedPeriodId = currentPeriod.id;

    // Calculate overpayment on current period
    const effectiveDue = newAmountDue - currentPeriod.discountAmount;
    overpayment = Math.max(0, currentPeriod.amountPaid - effectiveDue);
  }

  // Delete future-month periods
  const futurePeriodWhere = {
    groupMembershipId: membershipId,
    OR: [
      { periodYear: { gt: leaveYear } },
      { periodYear: leaveYear, periodMonth: { gt: leaveMonth } },
    ],
  };

  // Clean up AppliedPromotion records on future periods before deleting them
  // (AppliedPromotion.studentPaymentPeriodId has onDelete: Restrict)
  const futurePeriodIds = (
    await tx.studentPaymentPeriod.findMany({
      where: futurePeriodWhere,
      select: { id: true },
    })
  ).map((p) => p.id);

  if (futurePeriodIds.length > 0) {
    await tx.appliedPromotion.deleteMany({
      where: { studentPaymentPeriodId: { in: futurePeriodIds } },
    });

    // Sum up and delete any Payment records on future periods
    // (Payment.studentPaymentPeriodId has onDelete: Restrict)
    // Their amounts become part of the overpayment for transfer credit or refund
    const futurePayments = await tx.payment.findMany({
      where: { studentPaymentPeriodId: { in: futurePeriodIds } },
      select: { amount: true },
    });
    for (const p of futurePayments) {
      overpayment += p.amount;
    }
    if (futurePayments.length > 0) {
      await tx.payment.deleteMany({
        where: { studentPaymentPeriodId: { in: futurePeriodIds } },
      });
    }
  }

  const futureResult = await tx.studentPaymentPeriod.deleteMany({
    where: futurePeriodWhere,
  });

  return {
    overpayment,
    adjustedPeriodId,
    futurePeriodsDeleted: futureResult.count,
  };
}
