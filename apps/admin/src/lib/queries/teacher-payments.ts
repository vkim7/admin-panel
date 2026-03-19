import { prisma } from "@/server/db";

/**
 * Get all TeacherPaymentPeriod records for a given month.
 * Includes teacher name, group publicId/type/level.
 * Ordered by teacher name, then group publicId.
 */
export async function getTeacherPaymentPeriods(year: number, month: number) {
  return prisma.teacherPaymentPeriod.findMany({
    where: { periodYear: year, periodMonth: month },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      group: { select: { id: true, publicId: true, type: true, level: true, progressStage: true } },
    },
    orderBy: [
      { teacher: { firstName: "asc" } },
      { group: { publicId: "asc" } },
    ],
  });
}

export type TeacherPayPeriodRow = Awaited<
  ReturnType<typeof getTeacherPaymentPeriods>
>[number];

/**
 * Aggregate stats for teacher pay in a given month:
 * total amount, paid amount, unpaid amount, record count, paid count.
 */
export async function getTeacherPaySummary(year: number, month: number) {
  const records = await prisma.teacherPaymentPeriod.findMany({
    where: { periodYear: year, periodMonth: month },
    select: { amount: true, status: true },
  });

  let totalAmount = 0;
  let paidAmount = 0;
  let paidCount = 0;

  for (const r of records) {
    totalAmount += r.amount;
    if (r.status === "PAID") {
      paidAmount += r.amount;
      paidCount++;
    }
  }

  return {
    totalAmount,
    paidAmount,
    unpaidAmount: totalAmount - paidAmount,
    recordCount: records.length,
    paidCount,
  };
}

export type TeacherPaySummary = Awaited<
  ReturnType<typeof getTeacherPaySummary>
>;

/**
 * All payment periods for a specific teacher, ordered by period desc.
 * For the teacher detail page.
 */
export async function getTeacherPaymentHistory(teacherId: string) {
  return prisma.teacherPaymentPeriod.findMany({
    where: { teacherId },
    include: {
      group: { select: { id: true, publicId: true, type: true } },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
}

export type TeacherPayHistoryRow = Awaited<
  ReturnType<typeof getTeacherPaymentHistory>
>[number];
