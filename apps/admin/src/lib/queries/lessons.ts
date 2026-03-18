import { prisma } from "@/server/db";
import { timeToMinutes } from "@/lib/helpers/lesson-scheduling";

export async function getLessonsForGroup(groupId: string) {
  return prisma.lesson.findMany({
    where: { groupId },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      originalTeacher: { select: { id: true, firstName: true, lastName: true } },
      cancellationReason: { select: { id: true, name: true } },
      rescheduledFrom: { select: { id: true, lessonNumber: true } },
    },
    orderBy: { lessonDate: "asc" },
  });
}

export type LessonWithDetails = Awaited<ReturnType<typeof getLessonsForGroup>>[number];

export async function getPendingResolutionLessons() {
  return prisma.lesson.findMany({
    where: { status: "PENDING_RESOLUTION" },
    include: {
      group: { select: { id: true, publicId: true, startTime: true, durationMinutes: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      originalTeacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { pendingAt: "asc" },
  });
}

export type PendingLesson = Awaited<ReturnType<typeof getPendingResolutionLessons>>[number];

export async function getPendingResolutionCount() {
  return prisma.lesson.count({
    where: { status: "PENDING_RESOLUTION" },
  });
}

export async function getCancellationReasons() {
  return prisma.cancellationReason.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export type CancellationReasonOption = Awaited<ReturnType<typeof getCancellationReasons>>[number];

/**
 * Find active teachers available for substitution on a given date/time.
 * Excludes teachers with schedule slot conflicts or unavailability.
 */
export async function getAvailableSubstitutes(
  date: Date,
  startTime: string,
  durationMinutes: number,
  excludeTeacherId: string,
) {
  const lessonStart = timeToMinutes(startTime);
  const lessonEnd = lessonStart + durationMinutes;

  // Get all active teachers except the excluded one
  const teachers = await prisma.teacher.findMany({
    where: {
      isActive: true,
      id: { not: excludeTeacherId },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: { firstName: "asc" },
  });

  if (teachers.length === 0) return [];

  const teacherIds = teachers.map((t) => t.id);

  // Find teachers with schedule conflicts on this date
  const conflictingSlots = await prisma.teacherScheduleSlot.findMany({
    where: {
      teacherId: { in: teacherIds },
      date,
    },
    select: {
      teacherId: true,
      startTime: true,
      group: { select: { durationMinutes: true } },
    },
  });

  const busyTeacherIds = new Set<string>();
  for (const slot of conflictingSlots) {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = slotStart + slot.group.durationMinutes;
    if (lessonStart < slotEnd && slotStart < lessonEnd) {
      busyTeacherIds.add(slot.teacherId);
    }
  }

  // Find teachers with unavailability on this date
  const unavailabilities = await prisma.teacherUnavailability.findMany({
    where: {
      teacherId: { in: teacherIds },
      date,
    },
    select: {
      teacherId: true,
      startTime: true,
      endTime: true,
    },
  });

  for (const ua of unavailabilities) {
    if (ua.startTime === null) {
      // Whole day
      busyTeacherIds.add(ua.teacherId);
    } else {
      const uaStart = timeToMinutes(ua.startTime);
      const uaEnd = ua.endTime ? timeToMinutes(ua.endTime) : 1440;
      if (lessonStart < uaEnd && uaStart < lessonEnd) {
        busyTeacherIds.add(ua.teacherId);
      }
    }
  }

  return teachers.filter((t) => !busyTeacherIds.has(t.id));
}

export async function getTeacherUnavailability(teacherId: string) {
  return prisma.teacherUnavailability.findMany({
    where: { teacherId },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: "desc" },
  });
}

export type TeacherUnavailabilityRecord = Awaited<
  ReturnType<typeof getTeacherUnavailability>
>[number];

export async function getStudentCancellationCount(
  groupId: string,
  year: number,
  month: number,
) {
  // Count CANCELLED lessons with "Student request" reason in a given month
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const endOfMonth = new Date(Date.UTC(year, month, 0));

  return prisma.lesson.count({
    where: {
      groupId,
      status: "CANCELLED",
      lessonDate: { gte: startOfMonth, lte: endOfMonth },
      cancellationReason: { name: "Student request" },
    },
  });
}

export async function getTeachersForGroupReassignment(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { teacherId: true },
  });

  if (!group) return [];

  return prisma.teacher.findMany({
    where: {
      isActive: true,
      id: { not: group.teacherId },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: { firstName: "asc" },
  });
}
