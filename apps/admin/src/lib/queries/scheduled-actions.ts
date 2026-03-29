import { prisma } from "@/server/db";

export type ScheduledActionRow = Awaited<ReturnType<typeof getScheduledActions>>[number];

export async function getScheduledActions() {
  return prisma.scheduledAction.findMany({
    orderBy: [{ status: "asc" }, { effectiveDate: "asc" }],
    include: {
      student: { select: { id: true, crmCode: true, firstName: true, lastName: true } },
      membership: { select: { id: true, group: { select: { id: true, publicId: true } } } },
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

export type GroupScheduledActionRow = Awaited<
  ReturnType<typeof getScheduledActionsForGroup>
>[number];

/**
 * Fetch all pending scheduled actions related to a specific group
 * (both incoming and outgoing).
 */
export async function getScheduledActionsForGroup(groupId: string) {
  return prisma.scheduledAction.findMany({
    where: {
      status: "PENDING",
      OR: [
        // Incoming: transfers/merges targeting this group
        { destGroupId: groupId },
        // Outgoing: merges/transfers from this group (via sourceGroupId)
        { sourceGroupId: groupId },
        // Outgoing: student actions (transfer/reassignment/lost) from memberships in this group
        {
          type: { in: ["TRANSFER", "SEND_TO_REASSIGNMENT", "SEND_TO_LOST"] },
          membership: { groupId },
        },
      ],
    },
    orderBy: { effectiveDate: "asc" },
    include: {
      student: {
        select: {
          id: true,
          crmCode: true,
          firstName: true,
          lastName: true,
        },
      },
      sourceGroup: { select: { id: true, publicId: true } },
      destGroup: { select: { id: true, publicId: true } },
      membership: {
        select: { id: true, group: { select: { id: true, publicId: true } } },
      },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });
}
