import { prisma } from "@/server/db";
import { performLeaveBilling } from "@/lib/helpers/leave-billing";
import { removeFamilyIfNeeded } from "@/lib/helpers/promotion-auto-detect";
import { UNCERTAIN_CLEAR_FIELDS, resolveUncertainHistory } from "@/lib/helpers/uncertain";

export interface ExecuteSendToLostParams {
  studentId: string;
  membershipId: string;
  lostReasonId: string;
  otherLostReason: string | null;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteSendToLostResult {
  success: true;
  revalidatePaths: string[];
}

export async function executeSendToLost(
  params: ExecuteSendToLostParams,
): Promise<{ error: string } | ExecuteSendToLostResult> {
  const { studentId, membershipId, lostReasonId, otherLostReason, adminId, effectiveDate } = params;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      groupMemberships: {
        where: { leaveDate: null },
        select: { id: true, isTrial: true, group: { select: { id: true, publicId: true } } },
      },
    },
  });

  if (!student) {
    return { error: "Student not found" };
  }

  const membership = student.groupMemberships.find((m) => m.id === membershipId);
  if (!membership) {
    return { error: "Membership not found or already closed" };
  }

  const reason = await prisma.lostReason.findUnique({
    where: { id: lostReasonId },
  });

  if (!reason) {
    return { error: "Invalid lost reason" };
  }

  if (reason.isOther && !otherLostReason) {
    return { error: "Please specify the reason" };
  }

  await prisma.$transaction(async (tx) => {
    // Close this membership
    await tx.groupMembership.update({
      where: { id: membershipId },
      data: { leaveDate: effectiveDate },
    });

    // Run leave billing for non-trial memberships
    if (!membership.isTrial) {
      const result = await performLeaveBilling({
        membershipId,
        leaveDate: effectiveDate,
        adjustmentType: "DROPOUT",
        adminId,
        tx,
      });

      if (result.overpayment > 0 && result.adjustedPeriodId) {
        await tx.refund.create({
          data: {
            studentId,
            studentPaymentPeriodId: result.adjustedPeriodId,
            amount: result.overpayment,
            status: "PENDING",
            initiatedById: adminId,
            note: `Left group ${membership.group.publicId}`,
          },
        });
      }
    }

    // Check remaining active memberships
    const remainingActive = student.groupMemberships.filter(
      (m) => m.id !== membershipId,
    ).length;

    // Combine deactivation + uncertain changes into a single update
    if (remainingActive === 0) {
      await tx.student.update({
        where: { id: studentId },
        data: {
          status: "INACTIVE",
          inactivatedAt: new Date(),
          inactivatedById: adminId,
          lostReasonId,
          otherLostReason,
          ...(student.isUncertain ? UNCERTAIN_CLEAR_FIELDS : {}),
        },
      });

      await removeFamilyIfNeeded({ familyId: student.familyId, tx });
    } else if (student.isUncertain) {
      await tx.student.update({
        where: { id: studentId },
        data: UNCERTAIN_CLEAR_FIELDS,
      });
    }

    if (student.isUncertain) {
      await resolveUncertainHistory(tx, studentId, adminId);
    }
  });

  return {
    success: true as const,
    revalidatePaths: [
      `/students/${studentId}`,
      "/students",
      "/reassignment",
      "/lost",
      "/uncertain",
      `/groups/${membership.group.id}`,
    ],
  };
}
