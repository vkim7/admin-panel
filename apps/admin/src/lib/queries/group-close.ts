import { prisma } from "@/server/db";

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface GroupCloseEligibility {
  groupId: string;
  publicId: string;
  alreadyClosed: boolean; // isActive=false (closed/graduated/merged)
  canClose: boolean;
  blockers: {
    activeMemberships: number;
    pendingScheduledActions: number;
  };
  // Preview counts for the confirm dialog
  futureLessonCount: number;
  futureExamCount: number;
  hasZoomMeeting: boolean;
}

export async function getGroupCloseEligibility(
  groupId: string,
): Promise<GroupCloseEligibility | null> {
  const today = todayUtc();

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      publicId: true,
      isActive: true,
      zoomMeetingId: true,
    },
  });

  if (!group) return null;

  const [activeMemberships, pendingScheduledActions, futureLessonCount, futureExamCount] =
    await Promise.all([
      prisma.groupMembership.count({
        where: { groupId, leaveDate: null },
      }),
      prisma.scheduledAction.count({
        where: {
          status: "PENDING",
          OR: [{ sourceGroupId: groupId }, { destGroupId: groupId }],
        },
      }),
      prisma.lesson.count({
        where: {
          groupId,
          status: "SCHEDULED",
          lessonDate: { gte: today },
        },
      }),
      prisma.exam.count({
        where: {
          groupId,
          scheduledDate: { gte: today },
        },
      }),
    ]);

  const alreadyClosed = !group.isActive;
  const canClose =
    !alreadyClosed &&
    activeMemberships === 0 &&
    pendingScheduledActions === 0;

  return {
    groupId: group.id,
    publicId: group.publicId,
    alreadyClosed,
    canClose,
    blockers: { activeMemberships, pendingScheduledActions },
    futureLessonCount,
    futureExamCount,
    hasZoomMeeting: group.zoomMeetingId !== null,
  };
}
