import { prisma } from "@/server/db";
import { getLevelCategory, calculateLessonsStart } from "@/lib/helpers/lesson-generation";
import { deleteZoomMeeting } from "@/lib/zoom";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";
import { checkScheduleConflicts } from "@/lib/helpers/lesson-scheduling";
import { performLeaveBilling } from "@/lib/helpers/leave-billing";
import { applyTransferCredit } from "@/lib/helpers/transfer-credit";
import { applyPromotionsToPeriods } from "@/lib/helpers/promotions";
import { getScheduledCapacity } from "@/lib/helpers/capacity";

export interface ExecuteMergeParams {
  sourceGroupId: string;
  destinationGroupId: string;
  adminId: string;
  effectiveDate: Date;
}

export interface ExecuteMergeResult {
  success: true;
  movedCount: number;
  warning?: string;
  revalidatePaths: string[];
}

export async function executeMerge(
  params: ExecuteMergeParams,
): Promise<{ error: string } | ExecuteMergeResult> {
  const { sourceGroupId, destinationGroupId, adminId, effectiveDate } = params;

  // Load source group
  const source = await prisma.group.findUnique({
    where: { id: sourceGroupId },
    include: {
      memberships: {
        where: { leaveDate: null },
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
        },
      },
      lessons: {
        where: { originalLessonId: null },
        select: { lessonNumber: true, lessonDate: true, status: true },
        orderBy: { lessonDate: "asc" },
      },
    },
  });

  if (!source) return { error: "Source group not found" };
  if (!source.isActive) return { error: "Source group is not active" };

  // Load destination group
  const dest = await prisma.group.findUnique({
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

  if (!dest) return { error: "Destination group not found" };
  if (!dest.isActive) return { error: "Destination group is not active" };

  // Same level check
  if (source.level !== dest.level) {
    return { error: "Source and destination groups must be at the same level" };
  }

  // Check for unresolved trials in source
  const unresolvedTrials = source.memberships.filter((m) => m.isTrial);
  if (unresolvedTrials.length > 0) {
    return { error: "Source group has unresolved trial memberships. Resolve them before merging." };
  }

  const activeMemberships = source.memberships.filter((m) => !m.isTrial);

  // Capacity check — accounts for pending scheduled actions
  const capacity = await getScheduledCapacity(destinationGroupId, effectiveDate);
  if (capacity.effectiveCount + activeMemberships.length > dest.maxStudents) {
    return {
      error: `Destination group cannot accommodate all ${activeMemberships.length} students (${capacity.effectiveCount}/${dest.maxStudents} effectively)`,
    };
  }

  // Per-student checks
  const languageWarnings: string[] = [];

  for (const m of activeMemberships) {
    // Schedule conflict (exclude source group since students are leaving it)
    const conflict = await checkScheduleConflicts(
      m.student.id,
      destinationGroupId,
      dest.days,
      dest.startTime,
      dest.durationMinutes,
      prisma,
      sourceGroupId,
    );
    if (conflict) return conflict;

    // Language mismatch warning (informational, not blocking)
    if (m.student.preferredLanguage !== "ANY" && dest.teacher) {
      if (dest.teacher.teachingLanguage !== "ANY" && m.student.preferredLanguage !== dest.teacher.teachingLanguage) {
        const langLabel = m.student.preferredLanguage === "UZBEK" ? "Uzbek" : "Russian";
        languageWarnings.push(
          `${m.student.firstName} ${m.student.lastName} prefers ${langLabel} instruction but destination teacher doesn't teach in ${langLabel}`,
        );
      }
    }

    // Duplicate check
    if (dest.memberships.some((dm) => dm.studentId === m.student.id)) {
      return { error: `Student ${m.student.firstName} ${m.student.lastName} is already in the destination group` };
    }
  }

  // Single atomic transaction
  await prisma.$transaction(async (tx) => {
    for (const m of activeMemberships) {
      // Count completed lessons
      const completedLessons = source.lessons.filter(
        (l) => l.lessonDate <= effectiveDate && l.status !== "CANCELLED",
      ).length;

      // (a) Close source membership
      await tx.groupMembership.update({
        where: { id: m.id },
        data: {
          leaveDate: effectiveDate,
          lessonsCompleted: completedLessons,
        },
      });

      // (b) Leave billing on source
      const leaveBilling = await performLeaveBilling({
        membershipId: m.id,
        leaveDate: effectiveDate,
        adjustmentType: "MERGE",
        adminId,
        tx,
      });

      // (c) Create destination membership
      const lessonsStart = calculateLessonsStart(dest.lessons, effectiveDate);

      const newMembership = await tx.groupMembership.create({
        data: {
          studentId: m.student.id,
          groupId: destinationGroupId,
          joinDate: effectiveDate,
          isTrial: false,
          lessonsStart,
          previousMembershipId: m.id,
          assignedById: adminId,
        },
      });

      // (d) Build destination billing periods
      const levelCategory = getLevelCategory(dest.level);
      const pricePerLesson = await getApplicablePrice(
        levelCategory,
        dest.type,
        effectiveDate,
        tx,
      );

      const destLessonDates = dest.lessons
        .filter((l) => l.lessonDate >= effectiveDate)
        .map((l) => l.lessonDate);

      const periods = buildPaymentPeriods(
        destLessonDates,
        effectiveDate,
        pricePerLesson,
        m.student.id,
        destinationGroupId,
        newMembership.id,
      );

      if (periods.length > 0) {
        await tx.studentPaymentPeriod.createMany({ data: periods });

        // Apply promotions to newly created billing periods
        await applyPromotionsToPeriods({
          studentId: m.student.id,
          membershipId: newMembership.id,
          groupLevel: dest.level,
          groupType: dest.type,
          tx,
        });
      }

      // (e) Apply transfer credit
      if (leaveBilling.overpayment > 0) {
        let fallbackPeriodId: string | null = null;
        if (periods.length === 0) {
          const sourcePeriod = await tx.studentPaymentPeriod.findFirst({
            where: { groupMembershipId: m.id },
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
          });
          fallbackPeriodId = sourcePeriod?.id ?? null;
        }

        await applyTransferCredit({
          studentId: m.student.id,
          membershipId: periods.length > 0 ? newMembership.id : null,
          credit: leaveBilling.overpayment,
          sourceGroupId,
          adminId,
          tx,
          fallbackPeriodId,
        });
      }
    }

    // Close source group
    await tx.group.update({
      where: { id: sourceGroupId },
      data: {
        mergedIntoGroupId: destinationGroupId,
        isActive: false,
      },
    });
  });

  // Best-effort: delete source group's Zoom meeting
  if (source.zoomMeetingId) {
    await deleteZoomMeeting(source.zoomMeetingId);
  }

  const revalidatePaths = [
    `/groups/${sourceGroupId}`,
    `/groups/${destinationGroupId}`,
    "/groups",
    "/schedule",
    "/payments",
  ];
  for (const m of activeMemberships) {
    revalidatePaths.push(`/students/${m.student.id}`);
  }

  return {
    success: true as const,
    movedCount: activeMemberships.length,
    ...(languageWarnings.length > 0 && { warning: languageWarnings.join(". ") }),
    revalidatePaths,
  };
}
