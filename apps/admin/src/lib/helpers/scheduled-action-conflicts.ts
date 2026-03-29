import type { ScheduledActionType } from "@eng/database";
import { prisma } from "@/server/db";

const ACTION_TYPE_LABELS: Record<ScheduledActionType, string> = {
  TRANSFER: "transfer",
  SEND_TO_REASSIGNMENT: "reassignment",
  SEND_TO_LOST: "send to lost list",
  DEACTIVATE: "deactivation",
  MERGE_GROUP: "group merge",
  ASSIGN: "assignment",
  CHANGE_TEACHER: "teacher change",
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Block immediate student action (transfer/reassign/lost) if same membership
 * has a pending scheduled action. Returns error message or null.
 */
export async function checkImmediateStudentActionConflict(
  membershipId: string,
): Promise<string | null> {
  const pending = await prisma.scheduledAction.findFirst({
    where: { membershipId, status: "PENDING" },
    select: { type: true, effectiveDate: true },
  });

  if (!pending) return null;

  return `This membership has a pending scheduled ${ACTION_TYPE_LABELS[pending.type]} on ${formatDate(pending.effectiveDate)}. Cancel or execute it first.`;
}

/**
 * Block immediate deactivate if student has ANY pending scheduled action.
 * Returns error message or null.
 */
export async function checkImmediateDeactivateConflict(
  studentId: string,
): Promise<string | null> {
  const pending = await prisma.scheduledAction.findFirst({
    where: { studentId, status: "PENDING" },
    select: { type: true, effectiveDate: true },
  });

  if (!pending) return null;

  return `This student has a pending scheduled ${ACTION_TYPE_LABELS[pending.type]} on ${formatDate(pending.effectiveDate)}. Cancel or execute it first.`;
}

/**
 * Block immediate merge if:
 * - Source group already has a pending scheduled merge, OR
 * - Any students in source group have pending scheduled actions with later effective dates
 * Returns error message or null.
 */
export async function checkImmediateMergeConflict(
  sourceGroupId: string,
): Promise<string | null> {
  // Check for pending scheduled merge on this group
  const pendingMerge = await prisma.scheduledAction.findFirst({
    where: { sourceGroupId, status: "PENDING", type: "MERGE_GROUP" },
    select: { effectiveDate: true },
  });

  if (pendingMerge) {
    return `This group has a pending scheduled merge on ${formatDate(pendingMerge.effectiveDate)}. Cancel or execute it first.`;
  }

  // Check for student-level scheduled actions on active memberships in this group
  const activeMembers = await prisma.groupMembership.findMany({
    where: { groupId: sourceGroupId, leaveDate: null },
    select: { id: true },
  });

  if (activeMembers.length === 0) return null;

  const membershipIds = activeMembers.map((m) => m.id);

  const studentAction = await prisma.scheduledAction.findFirst({
    where: {
      membershipId: { in: membershipIds },
      status: "PENDING",
    },
    select: { type: true, effectiveDate: true, student: { select: { firstName: true, lastName: true } } },
  });

  if (!studentAction) return null;

  const name = studentAction.student
    ? `${studentAction.student.firstName} ${studentAction.student.lastName}`
    : "A student";

  return `${name} in this group has a pending scheduled ${ACTION_TYPE_LABELS[studentAction.type]} on ${formatDate(studentAction.effectiveDate)}. Resolve all student scheduled actions before merging.`;
}

/**
 * Block creating a new scheduled action if:
 * - Same membership already has a pending one (student-level actions)
 * - Same source group already has a pending scheduled merge
 * Returns error message or null.
 */
export async function checkScheduledActionConflict(
  type: ScheduledActionType,
  membershipId?: string,
  sourceGroupId?: string,
  studentId?: string,
): Promise<string | null> {
  if (type === "MERGE_GROUP") {
    if (!sourceGroupId) return null;

    const pending = await prisma.scheduledAction.findFirst({
      where: { sourceGroupId, status: "PENDING", type: "MERGE_GROUP" },
      select: { effectiveDate: true },
    });

    if (pending) {
      return `This group already has a scheduled merge on ${formatDate(pending.effectiveDate)}. Cancel it first to schedule a new one.`;
    }

    return null;
  }

  // Student-level actions: one per membership
  if (!membershipId) return null;

  const pending = await prisma.scheduledAction.findFirst({
    where: { membershipId, status: "PENDING" },
    select: { type: true, effectiveDate: true },
  });

  if (pending) {
    return `This membership already has a scheduled ${ACTION_TYPE_LABELS[pending.type]} on ${formatDate(pending.effectiveDate)}. Cancel it first to schedule a new action.`;
  }

  return null;
}

/**
 * Check conflicts for a scheduled ASSIGN action.
 *
 * Blocks if:
 * - Student already has a pending ASSIGN to the same group
 * - Student already has a pending ASSIGN to another group of the same type
 * - Student has a pending DEACTIVATE
 * - Student has an active same-type membership with no scheduled departure before the join date
 *   (this is handled in execute-assign.ts, not here — we only check scheduled-action-level conflicts)
 */
export async function checkAssignConflicts(
  studentId: string,
  groupId: string,
  groupType: string,
  joinDate: Date,
): Promise<string | null> {
  // Check for pending deactivate
  const pendingDeactivate = await prisma.scheduledAction.findFirst({
    where: { studentId, status: "PENDING", type: "DEACTIVATE" },
    select: { effectiveDate: true },
  });
  if (pendingDeactivate) {
    return `This student has a pending deactivation on ${formatDate(pendingDeactivate.effectiveDate)}. Cancel it first.`;
  }

  // Check for pending ASSIGN to the same group
  const duplicateAssign = await prisma.scheduledAction.findFirst({
    where: { studentId, destGroupId: groupId, status: "PENDING", type: "ASSIGN" },
    select: { effectiveDate: true },
  });
  if (duplicateAssign) {
    return `This student already has a scheduled assignment to this group on ${formatDate(duplicateAssign.effectiveDate)}.`;
  }

  // Check for pending ASSIGN to another group of the same type
  const sameTypeAssign = await prisma.scheduledAction.findFirst({
    where: {
      studentId,
      status: "PENDING",
      type: "ASSIGN",
      destGroupId: { not: groupId },
      destGroup: { type: groupType as "GROUP" | "INDIVIDUAL" },
    },
    include: { destGroup: { select: { publicId: true } } },
  });
  if (sameTypeAssign) {
    const label = groupType === "GROUP" ? "group" : "individual";
    return `This student already has a scheduled ${label} assignment to ${sameTypeAssign.destGroup?.publicId} on ${formatDate(sameTypeAssign.effectiveDate)}.`;
  }

  return null;
}

/**
 * Block scheduling a CHANGE_TEACHER if the group already has one pending.
 * Returns error message or null.
 */
export async function checkChangeTeacherConflict(
  groupId: string,
): Promise<string | null> {
  const pending = await prisma.scheduledAction.findFirst({
    where: { sourceGroupId: groupId, status: "PENDING", type: "CHANGE_TEACHER" },
    select: { effectiveDate: true },
  });

  if (pending) {
    return `This group already has a scheduled teacher change on ${formatDate(pending.effectiveDate)}. Cancel it first.`;
  }

  return null;
}
