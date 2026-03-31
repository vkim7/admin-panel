import { prisma } from "@/server/db";
import { removeFamilyIfNeeded } from "@/lib/helpers/promotion-auto-detect";

export interface SendOrphanToLostParams {
  studentId: string;
  lostReasonId: string;
  otherLostReason: string | null;
  adminId: string;
}

export interface SendOrphanToLostResult {
  success: true;
  revalidatePaths: string[];
}

/**
 * Mark a student with no active memberships as INACTIVE (lost).
 *
 * Used for orphaned students (ACTIVE but no memberships) and
 * reassignment-table students (AWAITING_REASSIGNMENT, membership already closed).
 * No billing logic — memberships are already gone or were never there.
 */
export async function executeSendOrphanToLost(
  params: SendOrphanToLostParams,
): Promise<{ error: string } | SendOrphanToLostResult> {
  const { studentId, lostReasonId, otherLostReason, adminId } = params;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      groupMemberships: {
        where: { leaveDate: null },
        select: { id: true },
      },
    },
  });

  if (!student) {
    return { error: "Student not found" };
  }

  if (student.status === "INACTIVE") {
    return { error: "Student is already inactive" };
  }

  if (student.groupMemberships.length > 0) {
    return { error: "Student has active group memberships. Use Send to Lost List from the group page instead." };
  }

  // Validate lost reason
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

  return {
    success: true as const,
    revalidatePaths: [
      `/students/${studentId}`,
      "/students",
      "/reception",
      "/reassignment",
      "/lost",
    ],
  };
}
