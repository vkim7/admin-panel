import type { PrismaClient, Level, GroupType } from "@eng/database";
import { calculatePaymentStatus } from "@/lib/helpers/payment-status";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Apply eligible promotions to newly created billing periods for a membership.
 * Iterates over the student's active StudentPromotions, calculates discounts per period,
 * creates AppliedPromotion records, and updates discountAmount + paymentStatus on each period.
 *
 * Must be called within a transaction after billing periods have been created.
 */
export async function applyPromotionsToPeriods({
  studentId,
  membershipId,
  groupLevel,
  groupType,
  tx,
}: {
  studentId: string;
  membershipId: string;
  groupLevel: Level;
  groupType: GroupType;
  tx: TxClient;
}): Promise<void> {
  const now = new Date();

  // 1. Fetch student's active StudentPromotions with promotion details
  const studentPromotions = await tx.studentPromotion.findMany({
    where: {
      studentId,
      promotion: { isActive: true },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      promotion: true,
      _count: { select: { appliedPromotions: true } },
    },
  });

  if (studentPromotions.length === 0) return;

  // 2. Filter by eligibility (scope, campaign window, usage limits)
  const eligible: typeof studentPromotions = [];

  for (const sp of studentPromotions) {
    const promo = sp.promotion;

    // Campaign window check
    if (promo.validFrom && promo.validFrom > now) continue;
    if (promo.validTo && promo.validTo < now) continue;

    // Level scope check (empty array = all levels)
    if (promo.levels.length > 0 && !promo.levels.includes(groupLevel)) continue;

    // GroupType scope check (empty array = all types)
    if (promo.groupTypes.length > 0 && !promo.groupTypes.includes(groupType)) continue;

    // maxUsesPerStudent check
    if (promo.maxUsesPerStudent != null && sp._count.appliedPromotions >= promo.maxUsesPerStudent) {
      continue;
    }

    // maxUsesTotal check (count all AppliedPromotions across all students for this promotion)
    if (promo.maxUsesTotal != null) {
      const totalUsed = await tx.appliedPromotion.count({
        where: { studentPromotion: { promotionId: promo.id } },
      });
      if (totalUsed >= promo.maxUsesTotal) continue;
    }

    eligible.push(sp);
  }

  if (eligible.length === 0) return;

  // 3. Fetch newly created billing periods (discountAmount = 0) for this membership
  const periods = await tx.studentPaymentPeriod.findMany({
    where: {
      groupMembershipId: membershipId,
      discountAmount: 0,
    },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
  });

  if (periods.length === 0) return;

  // 4. Apply discounts: per period, stack all eligible promotions
  // Track how many periods each non-recurring promotion has been applied to
  const appliedCountPerPromo = new Map<string, number>();

  for (const period of periods) {
    let totalDiscount = 0;
    const appliedRecords: { studentPromotionId: string; discountAmount: number }[] = [];

    for (const sp of eligible) {
      const promo = sp.promotion;

      // Non-recurring: only apply to first eligible period
      if (!promo.isRecurring) {
        const appliedSoFar = appliedCountPerPromo.get(sp.id) ?? 0;
        if (appliedSoFar >= 1) continue;
      }

      // Recurring: check monthsUsed limit
      if (promo.isRecurring && promo.recurringMonths != null) {
        const appliedSoFar = appliedCountPerPromo.get(sp.id) ?? 0;
        if (sp.monthsUsed + appliedSoFar >= promo.recurringMonths) continue;
      }

      // Calculate discount amount for this period
      // TRIAL promotions: 50% off ONE lesson, not the whole period
      let discount: number;
      if (promo.discountType === "PERCENTAGE") {
        const base = promo.type === "TRIAL" ? period.pricePerLesson : period.amountDue;
        discount = Math.floor((base * (promo.discountPercent ?? 0)) / 100);
      } else {
        discount = promo.discountAmount ?? 0;
      }

      if (discount <= 0) continue;

      totalDiscount += discount;
      appliedRecords.push({ studentPromotionId: sp.id, discountAmount: discount });
      appliedCountPerPromo.set(sp.id, (appliedCountPerPromo.get(sp.id) ?? 0) + 1);
    }

    if (totalDiscount === 0) continue;

    // C#36: Clamp total discount to amountDue
    const clampedDiscount = Math.min(totalDiscount, period.amountDue);

    // If we clamped, proportionally reduce each record's discount
    if (clampedDiscount < totalDiscount) {
      const ratio = clampedDiscount / totalDiscount;
      let distributed = 0;
      for (let i = 0; i < appliedRecords.length; i++) {
        if (i === appliedRecords.length - 1) {
          // Last record gets the remainder to avoid rounding issues
          appliedRecords[i]!.discountAmount = clampedDiscount - distributed;
        } else {
          appliedRecords[i]!.discountAmount = Math.floor(appliedRecords[i]!.discountAmount * ratio);
          distributed += appliedRecords[i]!.discountAmount;
        }
      }
    }

    // 5. Create AppliedPromotion records
    for (const record of appliedRecords) {
      if (record.discountAmount <= 0) continue;
      await tx.appliedPromotion.create({
        data: {
          studentPaymentPeriodId: period.id,
          studentPromotionId: record.studentPromotionId,
          discountAmount: record.discountAmount,
        },
      });
    }

    // 6. Update period discountAmount and recalculate paymentStatus
    const newStatus = calculatePaymentStatus(
      period.amountDue,
      clampedDiscount,
      period.amountPaid,
    );

    await tx.studentPaymentPeriod.update({
      where: { id: period.id },
      data: {
        discountAmount: clampedDiscount,
        paymentStatus: newStatus,
      },
    });
  }

  // 7. Update monthsUsed on recurring StudentPromotions
  for (const sp of eligible) {
    const appliedCount = appliedCountPerPromo.get(sp.id) ?? 0;
    if (appliedCount > 0 && sp.promotion.isRecurring) {
      await tx.studentPromotion.update({
        where: { id: sp.id },
        data: { monthsUsed: sp.monthsUsed + appliedCount },
      });
    }
  }
}
