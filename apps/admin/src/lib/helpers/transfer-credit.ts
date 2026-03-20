import type { PrismaClient } from "@eng/database";
import { calculatePaymentStatus } from "@/lib/helpers/payment-status";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface TransferCreditResult {
  creditApplied: number;
  remainingCredit: number;
  refundCreated: boolean;
}

/**
 * Apply transfer credit across destination billing periods.
 * Iterates chronologically, applying credit as Payment records with isTransferCredit: true.
 * Creates a PENDING refund for any remainder that can't be absorbed.
 *
 * @param fallbackPeriodId - period to attach refund to if no destination periods exist
 */
export async function applyTransferCredit({
  studentId,
  membershipId,
  credit,
  sourceGroupId,
  adminId,
  tx,
  fallbackPeriodId,
}: {
  studentId: string;
  membershipId: string | null;
  credit: number;
  sourceGroupId: string;
  adminId: string;
  tx: TxClient;
  fallbackPeriodId: string | null;
}): Promise<TransferCreditResult> {
  if (credit <= 0) {
    return { creditApplied: 0, remainingCredit: 0, refundCreated: false };
  }

  // Resolve publicId for human-readable notes
  const sourceGroup = await tx.group.findUnique({
    where: { id: sourceGroupId },
    select: { publicId: true },
  });
  const sourceLabel = sourceGroup?.publicId ?? sourceGroupId;

  let remainingCredit = credit;
  let creditApplied = 0;

  // If we have a destination membership, try to absorb credit into its periods
  if (membershipId) {
    const destPeriods = await tx.studentPaymentPeriod.findMany({
      where: { groupMembershipId: membershipId },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });

    for (const period of destPeriods) {
      if (remainingCredit <= 0) break;

      const effectiveDue = period.amountDue - period.discountAmount;
      const canAbsorb = Math.max(0, effectiveDue - period.amountPaid);
      const creditToApply = Math.min(remainingCredit, canAbsorb);

      if (creditToApply <= 0) continue;

      await tx.payment.create({
        data: {
          studentId,
          studentPaymentPeriodId: period.id,
          amount: creditToApply,
          isTransferCredit: true,
          note: `Transfer credit from ${sourceLabel}`,
          recordedById: adminId,
        },
      });

      const newAmountPaid = period.amountPaid + creditToApply;
      const newStatus = calculatePaymentStatus(
        period.amountDue,
        period.discountAmount,
        newAmountPaid,
      );

      await tx.studentPaymentPeriod.update({
        where: { id: period.id },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus: newStatus,
        },
      });

      remainingCredit -= creditToApply;
      creditApplied += creditToApply;
    }

    // Residual credit — create pending refund attached to last destination period
    if (remainingCredit > 0 && destPeriods.length > 0) {
      const lastPeriod = destPeriods[destPeriods.length - 1]!;

      await tx.refund.create({
        data: {
          studentId,
          studentPaymentPeriodId: lastPeriod.id,
          amount: remainingCredit,
          status: "PENDING",
          initiatedById: adminId,
          note: `Residual transfer credit from ${sourceLabel} — exceeded destination billing`,
        },
      });

      return { creditApplied, remainingCredit, refundCreated: true };
    }
  }

  // No destination periods at all (or no membership) — full refund
  if (remainingCredit > 0) {
    const refundPeriodId = fallbackPeriodId;
    if (refundPeriodId) {
      await tx.refund.create({
        data: {
          studentId,
          studentPaymentPeriodId: refundPeriodId,
          amount: remainingCredit,
          status: "PENDING",
          initiatedById: adminId,
          note: `Transfer credit from ${sourceLabel} — no destination billing periods`,
        },
      });

      return { creditApplied, remainingCredit, refundCreated: true };
    }
  }

  return { creditApplied, remainingCredit, refundCreated: remainingCredit > 0 };
}
