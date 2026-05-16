"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { closeGroupSchema } from "@/schemas/group-close";
import { deleteZoomMeeting } from "@/lib/zoom";

/**
 * Close a group early — used when all students have left (trial rejection,
 * quit, reassignment) and the group should be retired without graduating or
 * merging. Terminal action, alongside graduate and merge.
 *
 * Preconditions (re-checked inside the transaction to be race-safe):
 *  - Group exists and is currently active
 *  - No active GroupMembership (every membership has leaveDate set)
 *  - No PENDING ScheduledAction referencing this group as source or dest
 *
 * Effects:
 *  - Future SCHEDULED lessons (today onward) deleted
 *  - Corresponding TeacherScheduleSlot rows deleted (frees teacher's calendar)
 *  - Future Exam rows (today onward) deleted
 *  - Current open GroupTeacherHistory row gets endDate=today
 *  - Group.isActive=false, closedAt=now, closedById, closedReason
 *  - Zoom meeting deleted (best-effort, outside transaction)
 *
 * Preserved: GroupMembership rows, past Lesson rows + attendance, past Exam
 * rows, StudentPaymentPeriod and TeacherPaymentPeriod, Recording rows.
 */
export async function closeGroup(data: unknown) {
  const admin = await requireAdmin();
  const parsed = closeGroupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { groupId, reason } = parsed.data;

  // today at 00:00 UTC — matches @db.Date semantics elsewhere in the codebase
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  let zoomMeetingId: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { id: groupId },
        select: { id: true, isActive: true, zoomMeetingId: true },
      });

      if (!group) throw new CloseGroupError("Group not found");
      if (!group.isActive) {
        throw new CloseGroupError("Group is already closed");
      }

      // Re-check eligibility inside the transaction — guards against races
      // where a student is added or a scheduled action is created between
      // the dialog opening and submission.
      const [activeMemberships, pendingActions] = await Promise.all([
        tx.groupMembership.count({
          where: { groupId, leaveDate: null },
        }),
        tx.scheduledAction.count({
          where: {
            status: "PENDING",
            OR: [{ sourceGroupId: groupId }, { destGroupId: groupId }],
          },
        }),
      ]);

      if (activeMemberships > 0) {
        throw new CloseGroupError(
          `Group still has ${activeMemberships} active student${activeMemberships === 1 ? "" : "s"}. ` +
            "Remove all students before closing.",
        );
      }

      if (pendingActions > 0) {
        throw new CloseGroupError(
          `Group has ${pendingActions} pending scheduled action${pendingActions === 1 ? "" : "s"}. ` +
            "Cancel them before closing.",
        );
      }

      zoomMeetingId = group.zoomMeetingId;

      // Find future SCHEDULED lessons so we can drop their schedule slots first.
      const futureLessons = await tx.lesson.findMany({
        where: {
          groupId,
          status: "SCHEDULED",
          lessonDate: { gte: today },
        },
        select: { id: true },
      });
      const futureLessonIds = futureLessons.map((l) => l.id);

      if (futureLessonIds.length > 0) {
        // Slots first (FK Restrict on lessonId)
        await tx.teacherScheduleSlot.deleteMany({
          where: { lessonId: { in: futureLessonIds } },
        });

        await tx.lesson.deleteMany({
          where: { id: { in: futureLessonIds } },
        });
      }

      // Future exams (no attendance/score tracked on Exam itself; date is
      // the only usable signal for "hasn't happened yet").
      await tx.exam.deleteMany({
        where: {
          groupId,
          scheduledDate: { gte: today },
        },
      });

      // Close the currently-open teacher history row.
      await tx.groupTeacherHistory.updateMany({
        where: { groupId, endDate: null },
        data: { endDate: today },
      });

      await tx.group.update({
        where: { id: groupId },
        data: {
          isActive: false,
          closedAt: now,
          closedById: admin.id,
          closedReason: reason,
          zoomMeetingId: null,
          zoomJoinUrl: null,
        },
      });
    });
  } catch (err) {
    if (err instanceof CloseGroupError) {
      return { error: err.message };
    }
    throw err;
  }

  // Best-effort Zoom cleanup, mirroring graduateGroup pattern.
  if (zoomMeetingId) {
    await deleteZoomMeeting(zoomMeetingId);
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);

  return { success: true as const };
}

class CloseGroupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloseGroupError";
  }
}
