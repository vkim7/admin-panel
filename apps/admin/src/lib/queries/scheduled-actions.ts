import { prisma } from "@/server/db";

export type ScheduledActionRow = Awaited<ReturnType<typeof getScheduledActions>>[number];

export async function getScheduledActions() {
  return prisma.scheduledAction.findMany({
    orderBy: [{ status: "asc" }, { effectiveDate: "asc" }],
    include: {
      student: { select: { id: true, crmCode: true, firstName: true, lastName: true } },
      membership: { select: { id: true, group: { select: { publicId: true } } } },
      sourceGroup: { select: { id: true, publicId: true } },
      destGroup: { select: { id: true, publicId: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });
}

export async function getScheduledActionCount() {
  return prisma.scheduledAction.count({
    where: { status: "PENDING" },
  });
}
