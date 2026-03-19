"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { transferStudentSchema } from "@/schemas/transfer";
import { getLevelCategory, calculateLessonsStart } from "@/lib/helpers/lesson-generation";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";
import { checkScheduleConflicts } from "@/lib/helpers/lesson-scheduling";
import { performLeaveBilling } from "@/lib/helpers/leave-billing";
import { calculatePaymentStatus } from "@/lib/helpers/payment-status";
import { previewTransferBilling } from "@/lib/queries/transfers";

/**
 * Transfer a student from one group to another.
 * Single transaction: leave billing on source, create membership + billing on destination,
 * apply transfer credit if overpayment.
 */
export async function transferStudent(data: unknown) {
  const admin = await requireAdmin();
  const parsed = transferStudentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { membershipId, destinationGroupId, transferReasonId, otherTransferReason } = parsed.data;

  // Load source membership
  const membership = await prisma.groupMembership.findUnique({
    where: { id: membershipId },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, level: true, preferredLanguage: true },
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
    return { error: "Cannot transfer a trial student. Resolve the trial first." };
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

  // Capacity check
  if (destGroup.memberships.length >= destGroup.maxStudents) {
    return { error: "Destination group is full" };
  }

  // Duplicate check — student not already in destination
  if (destGroup.memberships.some((m) => m.studentId === membership.studentId)) {
    return { error: "Student is already active in the destination group" };
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

  // Language enforcement for BEGINNER/ELEMENTARY
  const LANGUAGE_HARD_LEVELS = new Set(["BEGINNER", "ELEMENTARY"]);
  if (LANGUAGE_HARD_LEVELS.has(membership.student.level)) {
    const lang = membership.student.preferredLanguage;
    if (lang !== "ANY" && destGroup.teacher) {
      if (destGroup.teacher.teachingLanguage !== "ANY" && lang !== destGroup.teacher.teachingLanguage) {
        const langLabel = lang === "UZBEK" ? "Uzbek" : "Russian";
        return {
          error: `Student requires ${langLabel} instruction at ${membership.student.level} level, but destination teacher cannot teach in ${langLabel}`,
        };
      }
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

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Count completed lessons for the student in source group
  const completedLessons = membership.group.lessons.filter(
    (l) => l.lessonDate <= today && l.status !== "CANCELLED",
  ).length;

  const result = await prisma.$transaction(async (tx) => {
    // (a) Update source membership
    await tx.groupMembership.update({
      where: { id: membershipId },
      data: {
        leaveDate: today,
        transferReasonId,
        otherTransferReason: reason.isOther ? otherTransferReason : null,
        lessonsCompleted: completedLessons,
      },
    });

    // (b) Leave billing on source
    const leaveBilling = await performLeaveBilling({
      membershipId,
      leaveDate: today,
      adjustmentType: "TRANSFER",
      adminId: admin.id,
      tx,
    });

    // (c) Create destination membership
    const lessonsStart = calculateLessonsStart(destGroup.lessons, today);

    const newMembership = await tx.groupMembership.create({
      data: {
        studentId: membership.studentId,
        groupId: destinationGroupId,
        joinDate: today,
        isTrial: false,
        lessonsStart,
        previousMembershipId: membershipId,
        assignedById: admin.id,
      },
    });

    // (d) Create destination billing periods
    const levelCategory = getLevelCategory(destGroup.level);
    const pricePerLesson = await getApplicablePrice(
      levelCategory,
      destGroup.type,
      today,
      tx,
    );

    const destLessonDates = destGroup.lessons
      .filter((l) => l.lessonDate >= today)
      .map((l) => l.lessonDate);

    const periods = buildPaymentPeriods(
      destLessonDates,
      today,
      pricePerLesson,
      membership.studentId,
      destinationGroupId,
      newMembership.id,
    );

    if (periods.length > 0) {
      await tx.studentPaymentPeriod.createMany({ data: periods });
    }

    // (e) Transfer credit: spill over across destination periods, refund any remainder
    let transferCredit = 0;
    let remainingCredit = leaveBilling.overpayment;

    if (remainingCredit > 0 && periods.length > 0) {
      transferCredit = remainingCredit;

      // Fetch all destination periods in chronological order
      const destPeriods = await tx.studentPaymentPeriod.findMany({
        where: { groupMembershipId: newMembership.id },
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
            studentId: membership.studentId,
            studentPaymentPeriodId: period.id,
            amount: creditToApply,
            isTransferCredit: true,
            note: `Transfer credit from group ${membership.group.id}`,
            recordedById: admin.id,
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
      }

      // Residual credit exceeds all destination periods — create pending refund
      if (remainingCredit > 0) {
        // Attach refund to the last destination period for traceability
        const lastPeriod = destPeriods[destPeriods.length - 1]!;

        await tx.refund.create({
          data: {
            studentId: membership.studentId,
            studentPaymentPeriodId: lastPeriod.id,
            amount: remainingCredit,
            status: "PENDING",
            initiatedById: admin.id,
            note: `Residual transfer credit from group ${membership.group.id} — exceeded destination billing`,
          },
        });
      }
    }

    // Also handle case where there are no destination periods at all but there's an overpayment
    if (leaveBilling.overpayment > 0 && periods.length === 0) {
      transferCredit = leaveBilling.overpayment;

      // No destination periods to absorb credit — full refund
      // Use the last source period for traceability
      const sourcePeriod = await tx.studentPaymentPeriod.findFirst({
        where: { groupMembershipId: membershipId },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      });

      if (sourcePeriod) {
        await tx.refund.create({
          data: {
            studentId: membership.studentId,
            studentPaymentPeriodId: sourcePeriod.id,
            amount: leaveBilling.overpayment,
            status: "PENDING",
            initiatedById: admin.id,
            note: `Transfer credit from group ${membership.group.id} — no destination billing periods`,
          },
        });
      }
    }

    return { transferCredit, refundAmount: remainingCredit > 0 ? remainingCredit : 0 };
  });

  // Revalidate affected pages
  revalidatePath(`/groups/${membership.groupId}`);
  revalidatePath(`/groups/${destinationGroupId}`);
  revalidatePath(`/students/${membership.studentId}`);
  revalidatePath("/payments");
  revalidatePath("/schedule");

  return { success: true, transferCredit: result.transferCredit, refundAmount: result.refundAmount };
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
