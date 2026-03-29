import { prisma } from "@/server/db";
import { timeToMinutes } from "@/lib/helpers/lesson-scheduling";

export interface ExecuteChangeTeacherParams {
  groupId: string;
  newTeacherId: string;
  effectiveDate: Date;
  adminId: string;
}

export interface ExecuteChangeTeacherResult {
  success: true;
  revalidatePaths: string[];
}

/**
 * Check if a teacher has schedule conflicts or unavailabilities
 * on the given lesson dates for a group's time slot.
 * Used at both scheduling time (early feedback) and execution time (re-validation).
 */
export async function checkTeacherScheduleConflicts(
  teacherId: string,
  groupId: string,
  fromDate: Date,
): Promise<string | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { startTime: true, durationMinutes: true },
  });
  if (!group) return null;

  const futureLessons = await prisma.lesson.findMany({
    where: { groupId, status: "SCHEDULED", lessonDate: { gte: fromDate } },
    select: { lessonDate: true },
  });

  if (futureLessons.length === 0) return null;

  const futureDates = futureLessons.map((l) => l.lessonDate);
  const lessonStart = timeToMinutes(group.startTime);
  const lessonEnd = lessonStart + group.durationMinutes;

  const conflictingSlots = await prisma.teacherScheduleSlot.findMany({
    where: { teacherId, date: { in: futureDates } },
    select: { startTime: true, date: true, group: { select: { durationMinutes: true, publicId: true } } },
  });

  for (const slot of conflictingSlots) {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = slotStart + slot.group.durationMinutes;
    if (lessonStart < slotEnd && slotStart < lessonEnd) {
      const dateStr = slot.date.toISOString().split("T")[0];
      return `New teacher has a conflict on ${dateStr} with group ${slot.group.publicId}`;
    }
  }

  const unavailabilities = await prisma.teacherUnavailability.findMany({
    where: { teacherId, date: { in: futureDates } },
  });

  for (const ua of unavailabilities) {
    if (ua.startTime === null) {
      return `New teacher is unavailable on ${ua.date.toISOString().split("T")[0]}`;
    }
    const uaStart = timeToMinutes(ua.startTime);
    const uaEnd = ua.endTime ? timeToMinutes(ua.endTime) : 1440;
    if (lessonStart < uaEnd && uaStart < lessonEnd) {
      return `New teacher is unavailable on ${ua.date.toISOString().split("T")[0]}`;
    }
  }

  return null;
}

export async function executeChangeTeacher(
  params: ExecuteChangeTeacherParams,
): Promise<{ error: string } | ExecuteChangeTeacherResult> {
  const { groupId, newTeacherId, effectiveDate, adminId } = params;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, teacherId: true, startTime: true, durationMinutes: true, isActive: true },
  });

  if (!group) return { error: "Group not found" };
  if (!group.isActive) return { error: "Group is no longer active" };
  if (group.teacherId === newTeacherId) {
    return { error: "New teacher must be different from the current teacher" };
  }

  const newTeacher = await prisma.teacher.findUnique({
    where: { id: newTeacherId },
    select: { isActive: true },
  });

  if (!newTeacher?.isActive) {
    return { error: "New teacher must be active" };
  }

  // Re-validate schedule conflicts at execution time
  const conflict = await checkTeacherScheduleConflicts(newTeacherId, groupId, effectiveDate);
  if (conflict) return { error: conflict };

  // Get SCHEDULED lessons from effective date onward
  const futureLessons = await prisma.lesson.findMany({
    where: {
      groupId,
      status: "SCHEDULED",
      lessonDate: { gte: effectiveDate },
    },
    select: { id: true, lessonDate: true, startTime: true },
  });

  await prisma.$transaction(async (tx) => {
    // a. Update Group.teacherId
    await tx.group.update({
      where: { id: groupId },
      data: { teacherId: newTeacherId },
    });

    // b. Close current GroupTeacherHistory
    await tx.groupTeacherHistory.updateMany({
      where: { groupId, endDate: null },
      data: { endDate: effectiveDate },
    });

    // c. Create new GroupTeacherHistory
    await tx.groupTeacherHistory.create({
      data: {
        groupId,
        teacherId: newTeacherId,
        startDate: effectiveDate,
        changedById: adminId,
      },
    });

    // d. Update all SCHEDULED lessons from effective date onward
    if (futureLessons.length > 0) {
      const lessonIds = futureLessons.map((l) => l.id);

      await tx.lesson.updateMany({
        where: { id: { in: lessonIds } },
        data: {
          teacherId: newTeacherId,
          originalTeacherId: newTeacherId,
        },
      });

      // e. Delete old schedule slots, create new ones
      await tx.teacherScheduleSlot.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });

      await tx.teacherScheduleSlot.createMany({
        data: futureLessons.map((l) => ({
          teacherId: newTeacherId,
          date: l.lessonDate,
          startTime: l.startTime,
          groupId,
          lessonId: l.id,
        })),
      });
    }
  });

  return {
    success: true,
    revalidatePaths: [`/groups/${groupId}`, "/schedule", "/teachers"],
  };
}
