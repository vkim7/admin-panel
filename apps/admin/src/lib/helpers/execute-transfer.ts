import { prisma } from "@/server/db";
import {
  getLevelCategory,
  calculateLessonsStart,
} from "@/lib/helpers/lesson-generation";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";
import { checkScheduleConflicts } from "@/lib/helpers/lesson-scheduling";
import { performLeaveBilling } from "@/lib/helpers/leave-billing";
import { applyTransferCredit } from "@/lib/helpers/transfer-credit";
import { applyPromotionsToPeriods } from "@/lib/helpers/promotions";
import { getScheduledCapacity } from "@/lib/helpers/capacity";

export interface ExecuteTransferParams {
  membershipId: string;
  destinationGroupId: string;
  transferReasonId: string;
  otherTransferReason: string | null;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteTransferResult {
  success: true;
  transferCredit: number;
  refundAmount: number;
  warning?: string;
  revalidatePaths: string[];
}

export async function executeTransfer(
  params: ExecuteTransferParams,
): Promise<{ error: string } | ExecuteTransferResult> {
  const {
    membershipId,
    destinationGroupId,
    transferReasonId,
    otherTransferReason,
    adminId,
    effectiveDate,
  } = params;

  // Load source membership
  const membership = await prisma.groupMembership.findUnique({
    where: { id: membershipId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          level: true,
          preferredLanguage: true,
        },
      },
      group: {
        select: {
          id: true,
          level: true,
          type: true,
          days: true,
          startTime: true,
          durationMinutes: true,
          lessons: {
            where: { originalLessonId: null },
            select: { lessonNumber: true, lessonDate: true, status: true },
            orderBy: { lessonDate: "asc" },
          },
        },
      },
    },
  });

  if (!membership) {
    return { error: "Membership not found" };
  }

  if (membership.leaveDate) {
    return { error: "Student has already left this group" };
  }

  if (membership.isTrial) {
    return {
      error: "Cannot transfer a trial student. Resolve the trial first.",
    };
  }

  // Load destination group
  const destGroup = await prisma.group.findUnique({
    where: { id: destinationGroupId },
    include: {
      memberships: {
        where: { leaveDate: null },
        select: { id: true, studentId: true },
      },
      lessons: {
        where: { originalLessonId: null },
        select: { lessonNumber: true, lessonDate: true },
        orderBy: { lessonDate: "asc" },
      },
      teacher: { select: { teachingLanguage: true } },
    },
  });

  if (!destGroup) {
    return { error: "Destination group not found" };
  }

  if (!destGroup.isActive) {
    return { error: "Destination group is not active" };
  }

  // Capacity check — accounts for pending scheduled actions
  const capacity = await getScheduledCapacity(destinationGroupId, effectiveDate);
  if (capacity.availableSlots <= 0) {
    return { error: "Destination group is full" };
  }

  // Duplicate check — student not already in destination
  if (destGroup.memberships.some((m) => m.studentId === membership.studentId)) {
    return { error: "Student is already active in the destination group" };
  }

  // Membership type limit: max 1 GROUP + 1 INDIVIDUAL (exclude source group being left)
  const otherActive = await prisma.groupMembership.findMany({
    where: {
      studentId: membership.studentId,
      leaveDate: null,
      groupId: { notIn: [membership.groupId, destinationGroupId] },
    },
    include: { group: { select: { type: true, publicId: true } } },
  });
  const sameType = otherActive.find((m) => m.group.type === destGroup.type);
  if (sameType) {
    const label = destGroup.type === "GROUP" ? "group" : "individual";
    return {
      error: `${membership.student.firstName} ${membership.student.lastName} already has an active ${label} lesson (${sameType.group.publicId}). Students can have at most one group and one individual lesson.`,
    };
  }

  // C#40: Schedule conflict (exclude source group since student is leaving)
  const conflict = await checkScheduleConflicts(
    membership.studentId,
    destinationGroupId,
    destGroup.days,
    destGroup.startTime,
    destGroup.durationMinutes,
    prisma,
    membership.groupId,
  );
  if (conflict) return conflict;

  // Language mismatch warning (informational, not blocking)
  let languageWarning: string | undefined;
  if (membership.student.preferredLanguage !== "ANY" && destGroup.teacher) {
    if (
      destGroup.teacher.teachingLanguage !== "ANY" &&
      membership.student.preferredLanguage !== destGroup.teacher.teachingLanguage
    ) {
      const langLabel = membership.student.preferredLanguage === "UZBEK" ? "Uzbek" : "Russian";
      languageWarning = `${membership.student.firstName} ${membership.student.lastName} prefers ${langLabel} instruction but destination teacher doesn't teach in ${langLabel}`;
    }
  }

  // Validate transfer reason
  const reason = await prisma.transferReason.findUnique({
    where: { id: transferReasonId },
  });
  if (!reason || !reason.isActive) {
    return { error: "Invalid transfer reason" };
  }
  if (reason.isOther && !otherTransferReason) {
    return { error: "Please specify the transfer reason" };
  }

  // Count completed lessons for the student in source group
  const completedLessons = membership.group.lessons.filter(
    (l) => l.lessonDate <= effectiveDate && l.status !== "CANCELLED",
  ).length;

  const result = await prisma.$transaction(async (tx) => {
    // (a) Update source membership
    await tx.groupMembership.update({
      where: { id: membershipId },
      data: {
        leaveDate: effectiveDate,
        transferReasonId,
        otherTransferReason: reason.isOther ? otherTransferReason : null,
        lessonsCompleted: completedLessons,
      },
    });

    // (b) Leave billing on source
    const leaveBilling = await performLeaveBilling({
      membershipId,
      leaveDate: effectiveDate,
      adjustmentType: "TRANSFER",
      adminId,
      tx,
    });

    // (c) Create destination membership
    const lessonsStart = calculateLessonsStart(destGroup.lessons, effectiveDate);

    const newMembership = await tx.groupMembership.create({
      data: {
        studentId: membership.studentId,
        groupId: destinationGroupId,
        joinDate: effectiveDate,
        isTrial: false,
        lessonsStart,
        previousMembershipId: membershipId,
        assignedById: adminId,
      },
    });

    // (d) Create destination billing periods
    const levelCategory = getLevelCategory(destGroup.level);
    const pricePerLesson = await getApplicablePrice(
      levelCategory,
      destGroup.type,
      effectiveDate,
      tx,
    );

    const destLessonDates = destGroup.lessons
      .filter((l) => l.lessonDate >= effectiveDate)
      .map((l) => l.lessonDate);

    const periods = buildPaymentPeriods(
      destLessonDates,
      effectiveDate,
      pricePerLesson,
      membership.studentId,
      destinationGroupId,
      newMembership.id,
    );

    if (periods.length > 0) {
      await tx.studentPaymentPeriod.createMany({ data: periods });

      // Apply promotions to newly created billing periods
      await applyPromotionsToPeriods({
        studentId: membership.studentId,
        membershipId: newMembership.id,
        groupLevel: destGroup.level,
        groupType: destGroup.type,
        tx,
      });
    }

    // (e) Transfer credit: spill over across destination periods, refund any remainder
    let transferCredit = 0;

    if (leaveBilling.overpayment > 0) {
      transferCredit = leaveBilling.overpayment;

      // Find fallback period for refund if no destination periods
      let fallbackPeriodId: string | null = null;
      if (periods.length === 0) {
        const sourcePeriod = await tx.studentPaymentPeriod.findFirst({
          where: { groupMembershipId: membershipId },
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        });
        fallbackPeriodId = sourcePeriod?.id ?? null;
      }

      const creditResult = await applyTransferCredit({
        studentId: membership.studentId,
        membershipId: periods.length > 0 ? newMembership.id : null,
        credit: leaveBilling.overpayment,
        sourceGroupId: membership.group.id,
        adminId,
        tx,
        fallbackPeriodId,
      });

      return { transferCredit, refundAmount: creditResult.remainingCredit };
    }

    return { transferCredit: 0, refundAmount: 0 };
  });

  return {
    success: true as const,
    transferCredit: result.transferCredit,
    refundAmount: result.refundAmount,
    ...(languageWarning && { warning: languageWarning }),
    revalidatePaths: [
      `/groups/${membership.groupId}`,
      `/groups/${destinationGroupId}`,
      `/students/${membership.studentId}`,
      "/payments",
      "/schedule",
    ],
  };
}
