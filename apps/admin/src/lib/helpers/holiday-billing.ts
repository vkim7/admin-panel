import type { PrismaClient } from "@eng/database";
import { recalculateDiscount } from "@/lib/helpers/leave-billing";
import { calculatePaymentStatus } from "@/lib/helpers/payment-status";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface HolidayCancellationResult {
  lessonsAffected: number;
  groupsAffected: number;
  studentsAdjusted: number;
  refundsCreated: number;
}

/**
 * Cancel all scheduled lessons on a holiday date and adjust billing.
 *
 * For each affected billing period: reduce totalLessons by 1, recalculate amountDue,
 * discount, and status. If overpaid, apply credit to next month's period or create
 * a PENDING refund. Moves exams scheduled on the holiday to the next lesson date.
 */
export async function cancelLessonsForHoliday({
  holidayDate,
  adminId,
  tx,
}: {
  holidayDate: Date;
  adminId: string;
  tx: TxClient;
}): Promise<HolidayCancellationResult> {
  // Look up the "Holiday" cancellation reason
  const holidayReason = await tx.cancellationReason.findFirst({
    where: { name: "Holiday" },
    select: { id: true },
  });

  // 1. Find all SCHEDULED lessons on the holiday date
  const lessons = await tx.lesson.findMany({
    where: {
      lessonDate: holidayDate,
      status: "SCHEDULED",
    },
    select: {
      id: true,
      groupId: true,
    },
  });

  if (lessons.length === 0) {
    return {
      lessonsAffected: 0,
      groupsAffected: 0,
      studentsAdjusted: 0,
      refundsCreated: 0,
    };
  }

  // 2. Cancel lessons and delete their schedule slots
  const lessonIds = lessons.map((l) => l.id);

  await tx.lesson.updateMany({
    where: { id: { in: lessonIds } },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById: adminId,
      cancellationReasonId: holidayReason?.id ?? null,
    },
  });

  await tx.teacherScheduleSlot.deleteMany({
    where: { lessonId: { in: lessonIds } },
  });

  // 3. Get unique affected group IDs
  const groupIds = [...new Set(lessons.map((l) => l.groupId))];

  const holidayYear = holidayDate.getUTCFullYear();
  const holidayMonth = holidayDate.getUTCMonth() + 1; // 1-indexed

  let studentsAdjusted = 0;
  let refundsCreated = 0;

  // 4. For each affected group, adjust billing
  for (const groupId of groupIds) {
    // Find active memberships that overlap the holiday date
    const memberships = await tx.groupMembership.findMany({
      where: {
        groupId,
        leaveDate: null,
        joinDate: { lte: holidayDate },
      },
      select: { id: true, studentId: true },
    });

    for (const membership of memberships) {
      // Find the billing period for the holiday's month
      const period = await tx.studentPaymentPeriod.findUnique({
        where: {
          groupMembershipId_periodYear_periodMonth: {
            groupMembershipId: membership.id,
            periodYear: holidayYear,
            periodMonth: holidayMonth,
          },
        },
      });

      if (!period) continue;

      const newTotalLessons = Math.max(0, period.totalLessons - 1);
      const newAmountDue = newTotalLessons * period.pricePerLesson;

      const newDiscountAmount = await recalculateDiscount(
        period.id,
        newAmountDue,
        period.pricePerLesson,
        tx,
      );

      const newStatus = calculatePaymentStatus(
        newAmountDue,
        newDiscountAmount,
        period.amountPaid,
      );

      // Create audit record
      await tx.paymentPeriodAdjustment.create({
        data: {
          studentPaymentPeriodId: period.id,
          type: "HOLIDAY",
          previousTotalLessons: period.totalLessons,
          previousAmountDue: period.amountDue,
          previousDiscountAmount: period.discountAmount,
          newTotalLessons,
          newAmountDue,
          newDiscountAmount,
          adjustedById: adminId,
        },
      });

      // Update the period
      await tx.studentPaymentPeriod.update({
        where: { id: period.id },
        data: {
          totalLessons: newTotalLessons,
          amountDue: newAmountDue,
          discountAmount: newDiscountAmount,
          paymentStatus: newStatus,
        },
      });

      studentsAdjusted++;

      // Check for overpayment
      const effectiveDue = Math.max(0, newAmountDue - newDiscountAmount);
      const overpayment = Math.max(0, period.amountPaid - effectiveDue);

      if (overpayment > 0) {
        // Try to credit to next month's period for this membership
        const nextPeriod = await tx.studentPaymentPeriod.findFirst({
          where: {
            groupMembershipId: membership.id,
            OR: [
              { periodYear: holidayYear, periodMonth: { gt: holidayMonth } },
              { periodYear: { gt: holidayYear } },
            ],
          },
          orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
        });

        if (nextPeriod) {
          // Apply credit as a transfer payment
          const newAmountPaid = nextPeriod.amountPaid + overpayment;
          const creditStatus = calculatePaymentStatus(
            nextPeriod.amountDue,
            nextPeriod.discountAmount,
            newAmountPaid,
          );

          await tx.payment.create({
            data: {
              studentId: membership.studentId,
              studentPaymentPeriodId: nextPeriod.id,
              amount: overpayment,
              isTransferCredit: true,
              note: "Holiday credit adjustment",
              recordedById: adminId,
            },
          });

          await tx.studentPaymentPeriod.update({
            where: { id: nextPeriod.id },
            data: {
              amountPaid: newAmountPaid,
              paymentStatus: creditStatus,
            },
          });
        } else {
          // No future period — create PENDING refund
          await tx.refund.create({
            data: {
              studentId: membership.studentId,
              studentPaymentPeriodId: period.id,
              amount: overpayment,
              status: "PENDING",
              initiatedById: adminId,
              note: "Holiday billing adjustment — no future period for credit",
            },
          });

          refundsCreated++;
        }
      }
    }
  }

  // 5. Move exams scheduled on the holiday date to the next lesson
  const exams = await tx.exam.findMany({
    where: { scheduledDate: holidayDate },
    select: { id: true, groupId: true },
  });

  for (const exam of exams) {
    const nextLesson = await tx.lesson.findFirst({
      where: {
        groupId: exam.groupId,
        lessonDate: { gt: holidayDate },
        status: "SCHEDULED",
      },
      orderBy: { lessonDate: "asc" },
      select: { lessonDate: true },
    });

    if (nextLesson) {
      await tx.exam.update({
        where: { id: exam.id },
        data: { scheduledDate: nextLesson.lessonDate },
      });
    }
  }

  return {
    lessonsAffected: lessons.length,
    groupsAffected: groupIds.length,
    studentsAdjusted,
    refundsCreated,
  };
}
