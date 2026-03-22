import type { PrismaClient } from "@eng/database";
import { calculatePaymentStatus } from "@/lib/helpers/payment-status";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Auto-detect and create WIN_BACK StudentPromotion if student is returning from Lost List.
 * Condition: student has lostReasonId set at activation time.
 */
export async function detectWinBack({
  studentId,
  lostReasonId,
  tx,
}: {
  studentId: string;
  lostReasonId: string | null;
  tx: TxClient;
}): Promise<void> {
  if (!lostReasonId) return;

  const winBackPromo = await tx.promotion.findFirst({
    where: { type: "WIN_BACK", isActive: true },
    select: { id: true, validityDays: true },
  });

  if (!winBackPromo) return;

  // Check if student already has this promotion (e.g., from a previous win-back cycle)
  const existing = await tx.studentPromotion.findFirst({
    where: { studentId, promotionId: winBackPromo.id },
  });

  if (existing) return;

  const expiresAt = winBackPromo.validityDays
    ? new Date(Date.now() + winBackPromo.validityDays * 24 * 60 * 60 * 1000)
    : null;

  await tx.studentPromotion.create({
    data: { studentId, promotionId: winBackPromo.id, expiresAt },
  });
}

/**
 * Auto-detect and create SEASONAL StudentPromotion if student is eligible.
 * Condition: 0 non-trial committed memberships AND an active SEASONAL campaign exists.
 */
export async function detectSeasonal({
  studentId,
  tx,
}: {
  studentId: string;
  tx: TxClient;
}): Promise<void> {
  const now = new Date();

  // Find active SEASONAL promotions within campaign window
  const seasonalPromos = await tx.promotion.findMany({
    where: {
      type: "SEASONAL",
      isActive: true,
      validFrom: { lte: now },
      validTo: { gte: now },
    },
    select: { id: true, validityDays: true },
  });

  if (seasonalPromos.length === 0) return;

  // Check eligibility: 0 non-trial committed memberships
  const committedCount = await tx.groupMembership.count({
    where: { studentId, isTrial: false },
  });

  if (committedCount > 0) return;

  // Attach each eligible SEASONAL promotion (usually just one active campaign at a time)
  for (const promo of seasonalPromos) {
    const existing = await tx.studentPromotion.findFirst({
      where: { studentId, promotionId: promo.id },
    });

    if (existing) continue;

    const expiresAt = promo.validityDays
      ? new Date(Date.now() + promo.validityDays * 24 * 60 * 60 * 1000)
      : null;

    await tx.studentPromotion.create({
      data: { studentId, promotionId: promo.id, expiresAt },
    });
  }
}

/**
 * Auto-detect and create FAMILY StudentPromotions when a family reaches 2+ active members.
 * Creates StudentPromotion for the joining student AND any existing active family members
 * who don't already have one.
 *
 * Returns the list of existing family member IDs who got a new FAMILY promotion
 * (so the caller can apply discounts to their future periods).
 */
export async function detectFamily({
  studentId,
  familyId,
  tx,
}: {
  studentId: string;
  familyId: string | null;
  tx: TxClient;
}): Promise<string[]> {
  if (!familyId) return [];

  const familyPromo = await tx.promotion.findFirst({
    where: { type: "FAMILY", isActive: true },
    select: { id: true, validityDays: true },
  });

  if (!familyPromo) return [];

  // Count active students in this family (including the one being activated)
  // The student being assigned may not be ACTIVE yet, so count those who are ACTIVE
  // plus the current student (about to be activated)
  const activeMembers = await tx.student.findMany({
    where: {
      familyId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  // Include the joining student (not yet ACTIVE at this point)
  const allMemberIds = new Set(activeMembers.map((m) => m.id));
  allMemberIds.add(studentId);

  if (allMemberIds.size < 2) return [];

  // Create FAMILY StudentPromotion for all members who don't have one
  const newlyPromotedMemberIds: string[] = [];

  for (const memberId of allMemberIds) {
    const existing = await tx.studentPromotion.findFirst({
      where: { studentId: memberId, promotionId: familyPromo.id },
    });

    if (existing) continue;

    const expiresAt = familyPromo.validityDays
      ? new Date(Date.now() + familyPromo.validityDays * 24 * 60 * 60 * 1000)
      : null;

    await tx.studentPromotion.create({
      data: { studentId: memberId, promotionId: familyPromo.id, expiresAt },
    });

    // Track existing members (not the joining student) who got a new promotion
    if (memberId !== studentId) {
      newlyPromotedMemberIds.push(memberId);
    }
  }

  return newlyPromotedMemberIds;
}

/**
 * Apply FAMILY discount to existing family members' future unpaid periods.
 * Called after detectFamily creates StudentPromotions for existing members.
 */
export async function applyFamilyToExistingMembers({
  memberIds,
  tx,
}: {
  memberIds: string[];
  tx: TxClient;
}): Promise<void> {
  if (memberIds.length === 0) return;

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  for (const memberId of memberIds) {
    // Find the FAMILY StudentPromotion we just created
    const familySp = await tx.studentPromotion.findFirst({
      where: {
        studentId: memberId,
        promotion: { type: "FAMILY", isActive: true },
      },
      include: { promotion: true },
    });

    if (!familySp) continue;

    // Find future unpaid periods for this student (no existing FAMILY discount applied)
    const futurePeriods = await tx.studentPaymentPeriod.findMany({
      where: {
        studentId: memberId,
        groupMembership: { leaveDate: null }, // Active memberships only
        OR: [
          { periodYear: { gt: currentYear } },
          { periodYear: currentYear, periodMonth: { gte: currentMonth } },
        ],
      },
      include: {
        appliedPromotions: {
          where: { studentPromotionId: familySp.id },
        },
      },
    });

    for (const period of futurePeriods) {
      // Skip if FAMILY already applied to this period
      if (period.appliedPromotions.length > 0) continue;

      // Calculate discount
      let discount: number;
      if (familySp.promotion.discountType === "PERCENTAGE") {
        discount = Math.floor(
          (period.amountDue * (familySp.promotion.discountPercent ?? 0)) / 100,
        );
      } else {
        discount = familySp.promotion.discountAmount ?? 0;
      }

      if (discount <= 0) continue;

      // Clamp to remaining payable amount (C#36)
      const remaining = period.amountDue - period.discountAmount;
      const clampedDiscount = Math.min(discount, remaining);
      if (clampedDiscount <= 0) continue;

      await tx.appliedPromotion.create({
        data: {
          studentPaymentPeriodId: period.id,
          studentPromotionId: familySp.id,
          discountAmount: clampedDiscount,
        },
      });

      const newDiscountAmount = period.discountAmount + clampedDiscount;
      const newStatus = calculatePaymentStatus(
        period.amountDue,
        newDiscountAmount,
        period.amountPaid,
      );

      await tx.studentPaymentPeriod.update({
        where: { id: period.id },
        data: {
          discountAmount: newDiscountAmount,
          paymentStatus: newStatus,
        },
      });
    }
  }
}

/**
 * Remove FAMILY promotions when family drops below 2 active members.
 * Expires StudentPromotions and removes discounts from future unpaid periods.
 */
export async function removeFamilyIfNeeded({
  familyId,
  tx,
}: {
  familyId: string | null;
  tx: TxClient;
}): Promise<void> {
  if (!familyId) return;

  const activeCount = await tx.student.count({
    where: { familyId, status: "ACTIVE" },
  });

  if (activeCount >= 2) return;

  // Family dropped below 2 — remove FAMILY promotions from remaining members
  const remainingMembers = await tx.student.findMany({
    where: { familyId, status: "ACTIVE" },
    select: { id: true },
  });

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  for (const member of remainingMembers) {
    const familySp = await tx.studentPromotion.findFirst({
      where: {
        studentId: member.id,
        promotion: { type: "FAMILY" },
      },
      select: { id: true },
    });

    if (!familySp) continue;

    // Expire the StudentPromotion
    await tx.studentPromotion.update({
      where: { id: familySp.id },
      data: { expiresAt: now },
    });

    // Remove discounts from future periods only
    const futureApplied = await tx.appliedPromotion.findMany({
      where: {
        studentPromotionId: familySp.id,
        studentPaymentPeriod: {
          OR: [
            { periodYear: { gt: currentYear } },
            { periodYear: currentYear, periodMonth: { gt: currentMonth } },
          ],
        },
      },
      include: { studentPaymentPeriod: true },
    });

    for (const ap of futureApplied) {
      const period = ap.studentPaymentPeriod;
      const newDiscountAmount = period.discountAmount - ap.discountAmount;
      const newStatus = calculatePaymentStatus(
        period.amountDue,
        newDiscountAmount,
        period.amountPaid,
      );

      await tx.appliedPromotion.delete({ where: { id: ap.id } });

      await tx.studentPaymentPeriod.update({
        where: { id: period.id },
        data: {
          discountAmount: newDiscountAmount,
          paymentStatus: newStatus,
        },
      });
    }
  }
}
