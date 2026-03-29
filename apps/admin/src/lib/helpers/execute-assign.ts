import { prisma } from "@/server/db";
import {
  getLevelCategory,
  calculateLessonsStart,
} from "@/lib/helpers/lesson-generation";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";
import { checkScheduleConflicts } from "@/lib/helpers/lesson-scheduling";
import { getScheduledCapacity } from "@/lib/helpers/capacity";
import { applyPromotionsToPeriods } from "@/lib/helpers/promotions";
import {
  detectWinBack,
  detectSeasonal,
  detectFamily,
  applyFamilyToExistingMembers,
} from "@/lib/helpers/promotion-auto-detect";

export interface ExecuteAssignParams {
  groupId: string;
  studentIds: string[];
  joinDate: Date;
  comment: string | null;
  adminId: string;
}

export interface ExecuteAssignResult {
  success: true;
  warning?: string;
  revalidatePaths: string[];
}

/**
 * Core assign logic — creates memberships, billing, activates students.
 * Used by both the immediate server action and the cron handler.
 */
export async function executeAssign(
  params: ExecuteAssignParams,
): Promise<{ error: string } | ExecuteAssignResult> {
  const { groupId, studentIds, joinDate, comment, adminId } = params;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
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
    },
  });

  if (!group) {
    return { error: "Group not found" };
  }

  // Capacity check — accounts for pending scheduled actions
  const capacity = await getScheduledCapacity(groupId, joinDate);
  if (studentIds.length > capacity.availableSlots) {
    return {
      error: `Not enough capacity. ${capacity.availableSlots} slot${capacity.availableSlots === 1 ? "" : "s"} available, ${studentIds.length} student${studentIds.length === 1 ? "" : "s"} selected.`,
    };
  }

  // Duplicate check: any students already active in this group
  const existingIds = new Set(group.memberships.map((m) => m.studentId));
  const duplicates = studentIds.filter((id) => existingIds.has(id));
  if (duplicates.length > 0) {
    return {
      error: `${duplicates.length} student${duplicates.length === 1 ? " is" : "s are"} already active in this group.`,
    };
  }

  // Fetch students early — needed for error messages in multiple checks below
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      level: true,
      preferredLanguage: true,
      familyId: true,
    },
  });

  // Schedule conflict detection
  for (const studentId of studentIds) {
    const conflict = await checkScheduleConflicts(
      studentId,
      groupId,
      group.days,
      group.startTime,
      group.durationMinutes,
      prisma,
    );
    if (conflict) return conflict;
  }

  // Membership type limit: max 1 GROUP + 1 INDIVIDUAL simultaneously
  // Date-aware: account for scheduled departures before joinDate
  for (const studentId of studentIds) {
    const otherActive = await prisma.groupMembership.findMany({
      where: { studentId, leaveDate: null, groupId: { not: groupId } },
      include: { group: { select: { id: true, type: true, publicId: true } } },
    });

    for (const m of otherActive) {
      if (m.group.type !== group.type) continue;

      // Check if this membership has a scheduled departure before our join date
      const pendingDeparture = await prisma.scheduledAction.findFirst({
        where: {
          membershipId: m.id,
          status: "PENDING",
          type: { in: ["TRANSFER", "SEND_TO_REASSIGNMENT", "SEND_TO_LOST"] },
          effectiveDate: { lte: joinDate },
        },
      });

      if (!pendingDeparture) {
        const s = students.find((st) => st.id === studentId);
        const label = group.type === "GROUP" ? "group" : "individual";
        return {
          error: `${s?.firstName} ${s?.lastName} already has an active ${label} lesson (${m.group.publicId}). Students can have at most one group and one individual lesson.`,
        };
      }
    }
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: group.teacherId },
    select: { teachingLanguage: true },
  });

  const languageWarnings: string[] = [];
  if (teacher) {
    for (const s of students) {
      if (s.preferredLanguage === "ANY") continue;
      if (teacher.teachingLanguage === "ANY") continue;

      if (s.preferredLanguage !== teacher.teachingLanguage) {
        const langLabel =
          s.preferredLanguage === "UZBEK" ? "Uzbek" : "Russian";
        languageWarnings.push(
          `${s.firstName} ${s.lastName} prefers ${langLabel} instruction but this group's teacher doesn't teach in ${langLabel}`,
        );
      }
    }
  }

  // Auto-calculate lessonsStart from joinDate
  const lessonsStart = calculateLessonsStart(group.lessons, joinDate);

  // Pre-compute trial attempts per student to auto-determine isTrial
  const trialLimit = group.type === "GROUP" ? 2 : 1;
  const trialCounts = await Promise.all(
    studentIds.map(async (studentId) => {
      const count = await prisma.groupMembership.count({
        where: {
          studentId,
          wasTrialOriginally: true,
          group: { type: group.type },
        },
      });
      return { studentId, hasTrialRemaining: count < trialLimit };
    }),
  );
  const trialMap = new Map(
    trialCounts.map((t) => [t.studentId, t.hasTrialRemaining]),
  );

  await prisma.$transaction(async (tx) => {
    for (const studentId of studentIds) {
      const isTrial = trialMap.get(studentId) ?? false;

      const membership = await tx.groupMembership.create({
        data: {
          studentId,
          groupId,
          joinDate,
          isTrial,
          wasTrialOriginally: isTrial,
          trialTeacherId: isTrial ? group.teacherId : null,
          lessonsStart,
          comment,
          assignedById: adminId,
        },
      });

      // For non-trial memberships: create billing periods
      let hasPeriods = false;
      if (!isTrial) {
        const levelCategory = getLevelCategory(group.level);
        const pricePerLesson = await getApplicablePrice(
          levelCategory,
          group.type,
          joinDate,
          tx,
        );

        const lessonDates = group.lessons
          .filter((l) => l.lessonDate >= joinDate)
          .map((l) => l.lessonDate);

        const periods = buildPaymentPeriods(
          lessonDates,
          joinDate,
          pricePerLesson,
          studentId,
          groupId,
          membership.id,
        );

        if (periods.length > 0) {
          await tx.studentPaymentPeriod.createMany({ data: periods });
          hasPeriods = true;
        }
      }

      // Fetch student state for auto-detection + activation
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { status: true, lostReasonId: true, familyId: true },
      });

      const studentInfo = students.find((s) => s.id === studentId);

      // --- Auto-detect promotions (before applyPromotionsToPeriods) ---

      // WIN_BACK: student has lostReasonId (came from Lost List)
      if (student) {
        await detectWinBack({
          studentId,
          lostReasonId: student.lostReasonId,
          tx,
        });
      }

      // SEASONAL: 0 non-trial committed memberships + active campaign
      await detectSeasonal({ studentId, tx });

      // FAMILY: 2+ active family members
      const newlyPromotedFamilyMembers = await detectFamily({
        studentId,
        familyId: studentInfo?.familyId ?? student?.familyId ?? null,
        tx,
      });

      // --- Activate student ---
      if (
        student &&
        (student.status === "AWAITING_ASSIGNMENT" ||
          student.status === "AWAITING_REASSIGNMENT" ||
          student.status === "INACTIVE")
      ) {
        const needsClearInactivation =
          student.status === "INACTIVE" ||
          (student.status === "AWAITING_REASSIGNMENT" &&
            student.lostReasonId != null);

        await tx.student.update({
          where: { id: studentId },
          data: {
            status: "ACTIVE",
            activatedAt: new Date(),
            activatedById: adminId,
            ...(needsClearInactivation && {
              inactivatedAt: null,
              inactivatedById: null,
              lostReasonId: null,
              otherLostReason: null,
            }),
          },
        });
      }

      // --- Apply all promotions to billing periods ---
      if (hasPeriods) {
        await applyPromotionsToPeriods({
          studentId,
          membershipId: membership.id,
          groupLevel: group.level,
          groupType: group.type,
          tx,
        });
      }

      // Apply FAMILY discount to existing family members' future periods
      await applyFamilyToExistingMembers({
        memberIds: newlyPromotedFamilyMembers,
        tx,
      });
    }
  });

  const revalidatePaths = [
    `/groups/${groupId}`,
    "/reception",
    "/reassignment",
    "/lost",
    "/schedule",
  ];

  if (languageWarnings.length > 0) {
    return {
      success: true,
      warning: languageWarnings.join(". "),
      revalidatePaths,
    };
  }
  return { success: true, revalidatePaths };
}
