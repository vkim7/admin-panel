import { prisma } from "@/server/db";
import { getNextLevel, canGraduate } from "@/lib/helpers/level-progression";
import { calculateEndDate, generateLessonDates, getLevelCategory } from "@/lib/helpers/lesson-generation";
import { findNextValidDate } from "@/lib/helpers/lesson-scheduling";
import { getApplicablePrice } from "@/lib/helpers/billing";
import { LEVEL_LABEL } from "@/lib/constants";

/**
 * Get all data needed for the graduation preview.
 * Returns computed new group details, active students, and pending refund warnings.
 */
export async function getGraduationPreview(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      memberships: {
        where: { leaveDate: null },
        include: {
          student: {
            select: {
              id: true,
              crmCode: true,
              firstName: true,
              lastName: true,
              level: true,
              status: true,
            },
          },
        },
      },
      lessons: {
        where: { originalLessonId: null },
        select: { lessonDate: true, status: true },
        orderBy: { lessonDate: "asc" },
      },
    },
  });

  if (!group) return null;

  const eligibility = canGraduate({
    level: group.level,
    isActive: group.isActive,
    skipAutoGraduation: group.skipAutoGraduation,
    lessons: group.lessons,
  });

  if (!eligibility.eligible) {
    return { eligible: false as const, reason: eligibility.reason };
  }

  const nextLevel = getNextLevel(group.level);
  if (!nextLevel) {
    return { eligible: false as const, reason: "No next level" };
  }

  // Compute new group details
  const holidays = await prisma.holiday.findMany({ select: { date: true } });
  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0]!),
  );

  // Find the last lesson date
  const lastLesson = group.lessons[group.lessons.length - 1];
  if (!lastLesson) {
    return { eligible: false as const, reason: "Group has no lessons" };
  }

  // Start date = next valid lesson date after last lesson, matching day pattern
  const startDate = findNextValidDate(lastLesson.lessonDate, group.days, holidayDates);
  if (!startDate) {
    return { eligible: false as const, reason: "Could not find a valid start date for the new group" };
  }

  const endDate = calculateEndDate(startDate);
  const lessonDates = generateLessonDates(startDate, endDate, group.days, holidayDates);

  // Get price for new level
  const levelCategory = getLevelCategory(nextLevel);
  // Use a read-only client for preview (not in transaction)
  const priceSetting = await prisma.priceSetting.findFirst({
    where: {
      levelCategory,
      groupType: group.type,
      effectiveFrom: { lte: startDate },
    },
    orderBy: { effectiveFrom: "desc" },
  });

  const pricePerLesson = priceSetting?.pricePerLesson ?? 0;

  // Check for pending refunds on continuing students
  const studentIds = group.memberships.map((m) => m.student.id);
  const pendingRefunds = await prisma.refund.findMany({
    where: {
      studentId: { in: studentIds },
      status: "PENDING",
    },
    select: { studentId: true, amount: true },
  });

  const pendingRefundsByStudent = new Map<string, number>();
  for (const r of pendingRefunds) {
    pendingRefundsByStudent.set(
      r.studentId,
      (pendingRefundsByStudent.get(r.studentId) ?? 0) + r.amount,
    );
  }

  return {
    eligible: true as const,
    newGroup: {
      level: nextLevel,
      levelLabel: LEVEL_LABEL[nextLevel] ?? nextLevel,
      teacher: group.teacher,
      days: group.days,
      startTime: group.startTime,
      durationMinutes: 80,
      startDate: startDate.toISOString().split("T")[0]!,
      endDate: endDate.toISOString().split("T")[0]!,
      lessonCount: lessonDates.length,
      pricePerLesson,
    },
    students: group.memberships.map((m) => ({
      id: m.student.id,
      crmCode: m.student.crmCode,
      firstName: m.student.firstName,
      lastName: m.student.lastName,
      pendingRefundAmount: pendingRefundsByStudent.get(m.student.id) ?? 0,
    })),
    pendingRefundCount: pendingRefunds.length,
  };
}
