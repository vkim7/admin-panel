import { prisma } from "@/server/db";

/** Far-future date used to get steady-state capacity (after all pending actions resolve). */
export const STEADY_STATE_DATE = new Date("2099-12-31T00:00:00Z");

/**
 * Scheduled capacity info for a group, accounting for pending scheduled actions.
 *
 * Used in two contexts:
 * 1. **Capacity checks** (date-aware) — pass a specific asOfDate (e.g. join date)
 *    to determine how many slots are available on that date.
 * 2. **Display** (steady-state) — pass a far-future date to see the final state
 *    after all pending actions resolve.
 */
export interface ScheduledCapacityInfo {
  currentActiveCount: number;
  scheduledDepartures: number;
  scheduledArrivals: number;
  effectiveCount: number;
  maxStudents: number;
  availableSlots: number;
}

/**
 * Compact departure/arrival counts for schedule page display.
 * Keyed by groupId.
 */
export type GroupScheduledCounts = Map<
  string,
  { departures: number; arrivals: number }
>;

/**
 * Compute date-aware capacity for a single group.
 *
 * Departures (student leaving this group by asOfDate):
 *   - TRANSFER / SEND_TO_REASSIGNMENT / SEND_TO_LOST with membershipId in this group
 *   - MERGE_GROUP with sourceGroupId = this group → all active source members leave
 *
 * Arrivals (student joining this group by asOfDate):
 *   - TRANSFER with destGroupId = this group
 *   - MERGE_GROUP with destGroupId = this group → all active source members arrive
 */
export async function getScheduledCapacity(
  groupId: string,
  asOfDate: Date,
): Promise<ScheduledCapacityInfo> {
  // Current active members
  const activeCount = await prisma.groupMembership.count({
    where: { groupId, leaveDate: null },
  });

  const maxStudents = await prisma.group
    .findUnique({ where: { id: groupId }, select: { maxStudents: true } })
    .then((g) => g?.maxStudents ?? 0);

  // Departures: student-level actions (transfer out, reassignment, lost) from this group
  const membershipDepartures = await prisma.scheduledAction.count({
    where: {
      status: "PENDING",
      type: { in: ["TRANSFER", "SEND_TO_REASSIGNMENT", "SEND_TO_LOST"] },
      effectiveDate: { lte: asOfDate },
      membership: { groupId },
    },
  });

  // Departures: merge where this group is the source (all active members leave)
  const mergeSourceActions = await prisma.scheduledAction.findMany({
    where: {
      status: "PENDING",
      type: "MERGE_GROUP",
      sourceGroupId: groupId,
      effectiveDate: { lte: asOfDate },
    },
    select: { id: true },
  });
  // If there's a pending merge sourcing from this group, all current members leave
  const mergeDepartures = mergeSourceActions.length > 0 ? activeCount : 0;

  // Arrivals: transfers and assigns targeting this group
  const transferArrivals = await prisma.scheduledAction.count({
    where: {
      status: "PENDING",
      type: { in: ["TRANSFER", "ASSIGN"] },
      destGroupId: groupId,
      effectiveDate: { lte: asOfDate },
    },
  });

  // Arrivals: merges targeting this group as destination (count source group active members)
  const mergeDestActions = await prisma.scheduledAction.findMany({
    where: {
      status: "PENDING",
      type: "MERGE_GROUP",
      destGroupId: groupId,
      effectiveDate: { lte: asOfDate },
    },
    select: { sourceGroupId: true },
  });
  let mergeArrivals = 0;
  for (const action of mergeDestActions) {
    if (action.sourceGroupId) {
      mergeArrivals += await prisma.groupMembership.count({
        where: { groupId: action.sourceGroupId, leaveDate: null },
      });
    }
  }

  const departures = membershipDepartures + mergeDepartures;
  const arrivals = transferArrivals + mergeArrivals;
  const effectiveCount = activeCount - departures + arrivals;

  return {
    currentActiveCount: activeCount,
    scheduledDepartures: departures,
    scheduledArrivals: arrivals,
    effectiveCount,
    maxStudents,
    availableSlots: maxStudents - effectiveCount,
  };
}

/**
 * Batch-fetch scheduled departure/arrival counts for all groups.
 * Used by the schedule page to avoid N+1 queries.
 *
 * Returns the "steady-state" counts (all pending actions, regardless of date).
 */
export async function getGroupScheduledCounts(): Promise<GroupScheduledCounts> {
  const counts: GroupScheduledCounts = new Map();

  // All pending actions
  const pendingActions = await prisma.scheduledAction.findMany({
    where: { status: "PENDING" },
    select: {
      type: true,
      sourceGroupId: true,
      destGroupId: true,
      membershipId: true,
      membership: { select: { groupId: true } },
    },
  });

  for (const action of pendingActions) {
    // Departures
    let departureGroupId: string | null = null;
    if (
      action.type === "TRANSFER" ||
      action.type === "SEND_TO_REASSIGNMENT" ||
      action.type === "SEND_TO_LOST"
    ) {
      departureGroupId = action.membership?.groupId ?? null;
    } else if (action.type === "MERGE_GROUP") {
      departureGroupId = action.sourceGroupId;
    }

    if (departureGroupId) {
      const entry = counts.get(departureGroupId) ?? { departures: 0, arrivals: 0 };
      entry.departures += 1;
      counts.set(departureGroupId, entry);
    }

    // Arrivals
    if (
      (action.type === "TRANSFER" || action.type === "MERGE_GROUP" || action.type === "ASSIGN") &&
      action.destGroupId
    ) {
      const entry = counts.get(action.destGroupId) ?? { departures: 0, arrivals: 0 };
      entry.arrivals += 1;
      counts.set(action.destGroupId, entry);
    }
  }

  return counts;
}
