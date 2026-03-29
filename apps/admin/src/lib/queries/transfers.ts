import { prisma } from "@/server/db";
import { getGroupScheduledCounts } from "@/lib/helpers/capacity";

/**
 * Get active transfer reasons, ordered by sortOrder.
 */
export async function getTransferReasons() {
  return prisma.transferReason.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export type TransferReason = Awaited<ReturnType<typeof getTransferReasons>>[number];

/**
 * Get all active groups except the current one, with member counts.
 * Used to populate the transfer destination picker.
 */
export async function getGroupsForTransfer(currentGroupId?: string) {
  const [groups, scheduledCounts] = await Promise.all([
    prisma.group.findMany({
      where: {
        isActive: true,
        ...(currentGroupId ? { id: { not: currentGroupId } } : {}),
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
    }),
    getGroupScheduledCounts(),
  ]);

  return groups.map((g) => {
    const counts = scheduledCounts.get(g.id);
    return {
      ...g,
      scheduledDepartures: counts?.departures ?? 0,
      scheduledArrivals: counts?.arrivals ?? 0,
    };
  });
}

export type TransferGroup = Awaited<ReturnType<typeof getGroupsForTransfer>>[number];

/**
 * Preview billing impact of a transfer. Read-only computation.
 */
export async function previewTransferBilling(
  membershipId: string,
  destinationGroupId: string,
) {
  const membership = await prisma.groupMembership.findUnique({
    where: { id: membershipId },
    include: {
      student: { select: { id: true } },
      group: {
        select: {
          id: true,
          level: true,
          type: true,
          lessons: {
            where: { originalLessonId: null },
            select: { lessonDate: true, status: true },
          },
        },
      },
      paymentPeriods: {
        select: {
          id: true,
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
  });

  if (!membership) return null;

  const destGroup = await prisma.group.findUnique({
    where: { id: destinationGroupId },
    select: {
      level: true,
      type: true,
      lessons: {
        where: { originalLessonId: null },
        select: { lessonDate: true },
        orderBy: { lessonDate: "asc" },
      },
    },
  });

  if (!destGroup) return null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const leaveYear = today.getUTCFullYear();
  const leaveMonth = today.getUTCMonth() + 1;

  // Source: current-month adjustment preview
  const currentPeriod = membership.paymentPeriods.find(
    (p) => p.periodYear === leaveYear && p.periodMonth === leaveMonth,
  );

  let sourceAdjustment: {
    periodLabel: string;
    previousTotalLessons: number;
    previousAmountDue: number;
    newTotalLessons: number;
    newAmountDue: number;
  } | null = null;

  let overpayment = 0;

  if (currentPeriod) {
    const lessonsUpToToday = membership.group.lessons.filter((l) => {
      const ly = l.lessonDate.getUTCFullYear();
      const lm = l.lessonDate.getUTCMonth() + 1;
      return (
        ly === leaveYear &&
        lm === leaveMonth &&
        l.lessonDate >= membership.joinDate &&
        l.lessonDate <= today &&
        l.status !== "CANCELLED"
      );
    }).length;

    const newAmountDue = lessonsUpToToday * currentPeriod.pricePerLesson;

    sourceAdjustment = {
      periodLabel: `${leaveYear}-${String(leaveMonth).padStart(2, "0")}`,
      previousTotalLessons: currentPeriod.totalLessons,
      previousAmountDue: currentPeriod.amountDue,
      newTotalLessons: lessonsUpToToday,
      newAmountDue,
    };

    const effectiveDue = newAmountDue - currentPeriod.discountAmount;
    overpayment = Math.max(0, currentPeriod.amountPaid - effectiveDue);
  }

  // Source: future periods to be deleted
  const futurePeriods = membership.paymentPeriods.filter(
    (p) =>
      p.periodYear > leaveYear ||
      (p.periodYear === leaveYear && p.periodMonth > leaveMonth),
  );

  // Destination: preview periods
  const destLessonDates = destGroup.lessons
    .filter((l) => l.lessonDate >= today)
    .map((l) => l.lessonDate);

  // Group dest lessons by month
  const destByMonth = new Map<string, number>();
  for (const date of destLessonDates) {
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
    destByMonth.set(key, (destByMonth.get(key) ?? 0) + 1);
  }

  // Get destination price (approximate — use current source price for preview)
  const pricePerLesson = currentPeriod?.pricePerLesson ?? 0;

  const destinationPeriods = [...destByMonth.entries()]
    .sort()
    .map(([key, lessons]) => {
      const [y, m] = key.split("-");
      return {
        periodLabel: `${y}-${String(Number(m)).padStart(2, "0")}`,
        totalLessons: lessons,
        amountDue: lessons * pricePerLesson,
      };
    });

  return {
    sourceAdjustment,
    futurePeriodsCount: futurePeriods.length,
    overpayment,
    destinationPeriods,
  };
}
