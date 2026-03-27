"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { transferStudentSchema } from "@/schemas/transfer";
import { executeTransfer } from "@/lib/helpers/execute-transfer";
import { getUzbekistanToday } from "@/lib/helpers/date";
import { checkImmediateStudentActionConflict, checkScheduledActionConflict } from "@/lib/helpers/scheduled-action-conflicts";
import { previewTransferBilling } from "@/lib/queries/transfers";

/**
 * Transfer a student from one group to another.
 * Today = immediate execution. Future date = creates scheduled action.
 */
export async function transferStudent(data: unknown) {
  const admin = await requireAdmin();
  const parsed = transferStudentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const effectiveDate = new Date(parsed.data.effectiveDate + "T00:00:00Z");
  const today = getUzbekistanToday();

  if (effectiveDate.getTime() < today.getTime()) {
    return { error: "Effective date cannot be in the past" };
  }

  if (effectiveDate.getTime() === today.getTime()) {
    // Immediate execution
    const conflict = await checkImmediateStudentActionConflict(parsed.data.membershipId);
    if (conflict) return { error: conflict };

    const result = await executeTransfer({
      membershipId: parsed.data.membershipId,
      destinationGroupId: parsed.data.destinationGroupId,
      transferReasonId: parsed.data.transferReasonId,
      otherTransferReason: parsed.data.otherTransferReason,
      adminId: admin.id,
      effectiveDate,
    });
    if ("error" in result) return { error: result.error };

    for (const path of result.revalidatePaths) revalidatePath(path);
    return {
      success: true,
      transferCredit: result.transferCredit,
      refundAmount: result.refundAmount,
      ...(result.warning && { warning: result.warning }),
    };
  }

  // Future date — create scheduled action
  const conflict = await checkScheduledActionConflict("TRANSFER", parsed.data.membershipId);
  if (conflict) return { error: conflict };

  // Look up the membership to get studentId and source group
  const membership = await prisma.groupMembership.findUnique({
    where: { id: parsed.data.membershipId },
    select: { studentId: true, groupId: true },
  });
  if (!membership) return { error: "Membership not found" };

  await prisma.scheduledAction.create({
    data: {
      type: "TRANSFER",
      effectiveDate,
      studentId: membership.studentId,
      membershipId: parsed.data.membershipId,
      sourceGroupId: membership.groupId,
      destGroupId: parsed.data.destinationGroupId,
      payload: {
        transferReasonId: parsed.data.transferReasonId,
        otherTransferReason: parsed.data.otherTransferReason,
      },
      createdById: admin.id,
    },
  });

  revalidatePath("/scheduled-actions");
  return { success: true, scheduled: true };
}

/**
 * Auth-gated wrapper for billing preview. Needed because client components
 * can't call queries directly.
 */
export async function getTransferBillingPreview(
  membershipId: string,
  destinationGroupId: string,
) {
  await requireAdmin();
  return previewTransferBilling(membershipId, destinationGroupId);
}
