import { prisma } from "@/server/db";

/**
 * Get unpaid/partially-paid billing periods for a given month.
 * Used by the No Payment List page.
 */
export async function getUnpaidPeriods(year: number, month: number) {
  return prisma.studentPaymentPeriod.findMany({
    where: {
      periodYear: year,
      periodMonth: month,
      paymentStatus: { not: "PAID" },
    },
    include: {
      student: {
        select: {
          id: true,
          crmCode: true,
          firstName: true,
          lastName: true,
          phone: true,
          level: true,
          family: { select: { parentPhone: true } },
        },
      },
      group: {
        select: { id: true, publicId: true },
      },
      payments: {
        select: { id: true, amount: true, paymentMethod: true, paidAt: true },
        orderBy: { paidAt: "desc" },
      },
    },
    orderBy: [
      { student: { firstName: "asc" } },
    ],
  });
}

export type UnpaidPeriod = Awaited<ReturnType<typeof getUnpaidPeriods>>[number];

/**
 * Get all billing periods for a student (across all memberships).
 * Used on the student detail page payments section.
 */
export async function getStudentPaymentPeriods(studentId: string) {
  return prisma.studentPaymentPeriod.findMany({
    where: { studentId },
    include: {
      group: { select: { id: true, publicId: true } },
      payments: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          note: true,
          isTransferCredit: true,
          paidAt: true,
          recordedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { paidAt: "desc" },
      },
      adjustments: {
        select: {
          id: true,
          type: true,
          previousAmountDue: true,
          newAmountDue: true,
          previousTotalLessons: true,
          newTotalLessons: true,
          previousDiscountAmount: true,
          newDiscountAmount: true,
          reason: true,
          createdAt: true,
          adjustedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
}

export type StudentPaymentPeriodWithDetails = Awaited<
  ReturnType<typeof getStudentPaymentPeriods>
>[number];

/**
 * Get a single billing period by ID (for the adjustment dialog).
 */
export async function getPaymentPeriodById(id: string) {
  return prisma.studentPaymentPeriod.findUnique({
    where: { id },
    include: {
      student: { select: { firstName: true, lastName: true } },
      group: { select: { publicId: true } },
    },
  });
}
