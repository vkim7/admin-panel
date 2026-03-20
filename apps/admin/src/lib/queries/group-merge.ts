import { prisma } from "@/server/db";
import { getLevelCategory, calculateLessonsStart } from "@/lib/helpers/lesson-generation";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";

/**
 * Get active groups at the same level as the source, with capacity for merge.
 * Excludes the source group itself.
 */
export async function getGroupsForMerge(sourceGroupId: string) {
  const source = await prisma.group.findUnique({
    where: { id: sourceGroupId },
    select: { level: true },
  });

  if (!source) return [];

  return prisma.group.findMany({
    where: {
      isActive: true,
      level: source.level,
      id: { not: sourceGroupId },
    },
    select: {
      id: true,
      publicId: true,
      type: true,
      level: true,
      progressStage: true,
      days: true,
      startTime: true,
      durationMinutes: true,
      maxStudents: true,
      teacher: {
        select: { firstName: true, lastName: true },
      },
      _count: {
        select: {
          memberships: {
            where: { leaveDate: null },
          },
        },
      },
    },
    orderBy: { publicId: "asc" },
  });
}

export type MergeGroup = Awaited<ReturnType<typeof getGroupsForMerge>>[number];

/**
 * Preview billing impact of merging source into destination.
 * Read-only computation, per-student breakdown.
 */
export async function previewMergeBilling(sourceGroupId: string, destGroupId: string) {
  const [source, dest] = await Promise.all([
    prisma.group.findUnique({
      where: { id: sourceGroupId },
      include: {
        memberships: {
          where: { leaveDate: null, isTrial: false },
          include: {
            student: { select: { id: true, firstName: true, lastName: true, crmCode: true } },
            paymentPeriods: {
              select: {
                periodYear: true,
                periodMonth: true,
                totalLessons: true,
                pricePerLesson: true,
                amountDue: true,
                discountAmount: true,
                amountPaid: true,
              },
            },
          },
        },
        lessons: {
          where: { originalLessonId: null },
          select: { lessonDate: true, status: true },
        },
      },
    }),
    prisma.group.findUnique({
      where: { id: destGroupId },
      select: {
        level: true,
        type: true,
        lessons: {
          where: { originalLessonId: null },
          select: { lessonDate: true },
          orderBy: { lessonDate: "asc" },
        },
      },
    }),
  ]);

  if (!source || !dest) return null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const leaveYear = today.getUTCFullYear();
  const leaveMonth = today.getUTCMonth() + 1;

  const destLessonDates = dest.lessons
    .filter((l) => l.lessonDate >= today)
    .map((l) => l.lessonDate);

  const students = source.memberships.map((m) => {
    // Source current-month adjustment
    const currentPeriod = m.paymentPeriods.find(
      (p) => p.periodYear === leaveYear && p.periodMonth === leaveMonth,
    );

    let overpayment = 0;
    let sourceAdjustment: {
      previousAmountDue: number;
      newAmountDue: number;
      previousTotalLessons: number;
      newTotalLessons: number;
    } | null = null;

    if (currentPeriod) {
      const lessonsUpToToday = source.lessons.filter((l) => {
        const ly = l.lessonDate.getUTCFullYear();
        const lm = l.lessonDate.getUTCMonth() + 1;
        return (
          ly === leaveYear &&
          lm === leaveMonth &&
          l.lessonDate >= m.joinDate &&
          l.lessonDate <= today &&
          l.status !== "CANCELLED"
        );
      }).length;

      const newAmountDue = lessonsUpToToday * currentPeriod.pricePerLesson;
      const effectiveDue = newAmountDue - currentPeriod.discountAmount;
      overpayment = Math.max(0, currentPeriod.amountPaid - effectiveDue);

      sourceAdjustment = {
        previousAmountDue: currentPeriod.amountDue,
        newAmountDue,
        previousTotalLessons: currentPeriod.totalLessons,
        newTotalLessons: lessonsUpToToday,
      };
    }

    // Destination periods preview
    const destByMonth = new Map<string, number>();
    for (const date of destLessonDates) {
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
      destByMonth.set(key, (destByMonth.get(key) ?? 0) + 1);
    }

    const pricePerLesson = currentPeriod?.pricePerLesson ?? 0;
    const destPeriods = [...destByMonth.entries()].sort().map(([key, lessons]) => {
      const [y, mo] = key.split("-");
      return {
        periodLabel: `${y}-${String(Number(mo)).padStart(2, "0")}`,
        totalLessons: lessons,
        amountDue: lessons * pricePerLesson,
      };
    });

    return {
      studentId: m.student.id,
      crmCode: m.student.crmCode,
      firstName: m.student.firstName,
      lastName: m.student.lastName,
      sourceAdjustment,
      overpayment,
      destPeriods,
    };
  });

  const totalOverpayment = students.reduce((sum, s) => sum + s.overpayment, 0);

  return { students, totalOverpayment };
}
