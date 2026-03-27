import { prisma } from "@/server/db";
import { performLeaveBilling } from "@/lib/helpers/leave-billing";
import { removeFamilyIfNeeded } from "@/lib/helpers/promotion-auto-detect";

export interface ExecuteDeactivateParams {
  studentId: string;
  lostReasonId: string;
  otherLostReason: string | null;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteDeactivateResult {
  success: true;
  revalidatePaths: string[];
}

export async function executeDeactivate(
  params: ExecuteDeactivateParams,
): Promise<{ error: string } | ExecuteDeactivateResult> {
  const { studentId, lostReasonId, otherLostReason, adminId, effectiveDate } = params;

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

  if (student.status === "INACTIVE") {
    return { error: "Student is already inactive" };
  }

  // C#17: Validate that otherLostReason is provided if the reason isOther
  const reason = await prisma.lostReason.findUnique({
    where: { id: lostReasonId },
  });

  if (!reason) {
    return { error: "Invalid lost reason" };
  }

  if (reason.isOther && !otherLostReason) {
    return { error: "Please specify the reason" };
  }

  const groupIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    // Close all active memberships + leave billing
    for (const m of student.groupMemberships) {
      groupIds.add(m.group.id);

      await tx.groupMembership.update({
        where: { id: m.id },
        data: { leaveDate: effectiveDate },
      });

      // Run leave billing for non-trial memberships
      if (!m.isTrial) {
        const result = await performLeaveBilling({
          membershipId: m.id,
          leaveDate: effectiveDate,
          adjustmentType: "DROPOUT",
          adminId,
          tx,
        });

        // Create pending refund if overpayment exists
        if (result.overpayment > 0 && result.adjustedPeriodId) {
          await tx.refund.create({
            data: {
              studentId,
              studentPaymentPeriodId: result.adjustedPeriodId,
              amount: result.overpayment,
              status: "PENDING",
              initiatedById: adminId,
              note: `Deactivation from ${m.group.publicId}`,
            },
          });
        }
      }
    }

    await tx.student.update({
      where: { id: studentId },
      data: {
        status: "INACTIVE",
        inactivatedAt: new Date(),
        inactivatedById: adminId,
        lostReasonId,
        otherLostReason,
      },
    });

    // FAMILY auto-removal: if family drops below 2 active members,
    // expire FAMILY promotions and remove discounts from future periods
    await removeFamilyIfNeeded({ familyId: student.familyId, tx });
  });

  const revalidatePaths = [
    `/students/${studentId}`,
    "/students",
    "/reception",
    "/reassignment",
    "/lost",
  ];
  for (const gId of groupIds) {
    revalidatePaths.push(`/groups/${gId}`);
  }

  return { success: true as const, revalidatePaths };
}
