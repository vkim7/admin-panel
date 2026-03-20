import { prisma } from "@/server/db";

/**
 * Get all refunds with student info, group publicId, and admin details.
 * Ordered: PENDING first, then by initiatedAt desc.
 */
export async function getAllRefunds() {
  return prisma.refund.findMany({
    include: {
      student: {
        select: { id: true, crmCode: true, firstName: true, lastName: true },
      },
      studentPaymentPeriod: {
        select: {
          group: { select: { publicId: true } },
        },
      },
      initiatedBy: {
        select: { firstName: true, lastName: true },
      },
      processedBy: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: [
      { status: "asc" }, // PENDING before COMPLETED
      { initiatedAt: "desc" },
    ],
  });
}

export type RefundRow = Awaited<ReturnType<typeof getAllRefunds>>[number];

/**
 * Get count of pending refunds (for sidebar badge).
 */
export async function getPendingRefundCount() {
  return prisma.refund.count({
    where: { status: "PENDING" },
  });
}
