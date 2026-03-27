import { prisma } from "@/server/db";
import { performLeaveBilling } from "@/lib/helpers/leave-billing";
import { UNCERTAIN_CLEAR_FIELDS, resolveUncertainHistory } from "@/lib/helpers/uncertain";

export interface ExecuteReassignmentParams {
  studentId: string;
  membershipId?: string;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteReassignmentResult {
  success: true;
  revalidatePaths: string[];
}

export async function executeReassignment(
  params: ExecuteReassignmentParams,
): Promise<{ error: string } | ExecuteReassignmentResult> {
  const { studentId, membershipId, adminId, effectiveDate } = params;

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

  if (student.status !== "ACTIVE" && student.status !== "INACTIVE") {
    return { error: "Only active or inactive students can be sent to reassignment" };
  }

  // Validate membership before entering the transaction
  const targetMembership = membershipId
    ? student.groupMemberships.find((m) => m.id === membershipId)
    : null;
  if (membershipId && !targetMembership) {
    return { error: "Membership not found or already closed" };
  }

  let closedGroupId: string | null = null;

  await prisma.$transaction(async (tx) => {
    // Close specific membership if provided
    if (membershipId && targetMembership) {
      closedGroupId = targetMembership.group.id;

      await tx.groupMembership.update({
        where: { id: membershipId },
        data: { leaveDate: effectiveDate },
      });

      // Run leave billing for non-trial memberships
      if (!targetMembership.isTrial) {
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
              note: `Reassignment from ${targetMembership.group.publicId}`,
            },
          });
        }
      }
    }

    // Check remaining active memberships (excluding the one we just closed)
    const remainingActive = student.groupMemberships.filter(
      (m) => m.id !== membershipId,
    ).length;

    // Combine status + uncertain changes into a single update
    if (remainingActive === 0) {
      // Keep inactivation fields intact for INACTIVE → AWAITING_REASSIGNMENT.
      // lostReasonId != null at activation time = WIN_BACK student (came from Lost List).
      // Fields are cleared at the final activation point in addStudentsToGroup.
      await tx.student.update({
        where: { id: studentId },
        data: {
          status: "AWAITING_REASSIGNMENT",
          ...(student.isUncertain ? UNCERTAIN_CLEAR_FIELDS : {}),
        },
      });
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

  const revalidatePaths = [
    `/students/${studentId}`,
    "/students",
    "/reassignment",
    "/lost",
    "/uncertain",
  ];
  if (closedGroupId) {
    revalidatePaths.push(`/groups/${closedGroupId}`);
  }

  return { success: true as const, revalidatePaths };
}
