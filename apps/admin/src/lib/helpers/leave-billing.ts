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

    // Recalculate discount from AppliedPromotion records against the new amountDue.
    // Percentage-based promotions (non-TRIAL) were calculated on the original amountDue
    // and must be re-derived so the discount doesn't exceed the smaller period.
    const newDiscountAmount = await recalculateDiscount(
      currentPeriod.id,
      newAmountDue,
      currentPeriod.pricePerLesson,
      tx,
    );

    const newStatus = calculatePaymentStatus(
      newAmountDue,
      newDiscountAmount,
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
        newDiscountAmount,
        adjustedById: adminId,
      },
    });

    // Update the period
    await tx.studentPaymentPeriod.update({
      where: { id: currentPeriod.id },
      data: {
        totalLessons: newTotalLessons,
        amountDue: newAmountDue,
        discountAmount: newDiscountAmount,
        paymentStatus: newStatus,
        isPartialPeriod: true,
      },
    });

    adjustedPeriodId = currentPeriod.id;

    // Calculate overpayment on current period
    const effectiveDue = Math.max(0, newAmountDue - newDiscountAmount);
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

/**
 * Recalculate discount for a billing period after totalLessons/amountDue changed.
 *
 * Re-derives each AppliedPromotion's discount using the promotion's original rules
 * (percentage vs fixed, TRIAL base = pricePerLesson vs amountDue). Updates each
 * AppliedPromotion record and returns the new total, clamped to newAmountDue.
 */
export async function recalculateDiscount(
  periodId: string,
  newAmountDue: number,
  pricePerLesson: number,
  tx: TxClient,
): Promise<number> {
  const appliedPromotions = await tx.appliedPromotion.findMany({
    where: { studentPaymentPeriodId: periodId },
    include: {
      studentPromotion: {
        include: { promotion: true },
      },
    },
  });

  if (appliedPromotions.length === 0) return 0;

  let totalDiscount = 0;
  const updates: { id: string; discountAmount: number }[] = [];

  for (const ap of appliedPromotions) {
    const promo = ap.studentPromotion.promotion;

    let discount: number;
    if (promo.discountType === "PERCENTAGE") {
      // Mirror the logic in promotions.ts: TRIAL uses pricePerLesson, others use amountDue
      const base = promo.type === "TRIAL" ? pricePerLesson : newAmountDue;
      discount = Math.floor((base * (promo.discountPercent ?? 0)) / 100);
    } else {
      discount = promo.discountAmount ?? 0;
    }

    discount = Math.max(0, discount);
    totalDiscount += discount;
    updates.push({ id: ap.id, discountAmount: discount });
  }

  // Clamp total to newAmountDue, proportionally reduce if needed
  const clampedTotal = Math.min(totalDiscount, newAmountDue);
  if (clampedTotal < totalDiscount && totalDiscount > 0) {
    const ratio = clampedTotal / totalDiscount;
    let distributed = 0;
    for (let i = 0; i < updates.length; i++) {
      if (i === updates.length - 1) {
        updates[i]!.discountAmount = clampedTotal - distributed;
      } else {
        updates[i]!.discountAmount = Math.floor(updates[i]!.discountAmount * ratio);
        distributed += updates[i]!.discountAmount;
      }
    }
  }

  // Persist updated AppliedPromotion amounts
  for (const u of updates) {
    await tx.appliedPromotion.update({
      where: { id: u.id },
      data: { discountAmount: u.discountAmount },
    });
  }

  return clampedTotal;
}
