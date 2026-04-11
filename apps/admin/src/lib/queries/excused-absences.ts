import { prisma } from "@/server/db";

/**
 * Get all excused absences for a student, sorted by lesson date desc.
 */
export async function getStudentExcusedAbsences(studentId: string) {
  return prisma.excusedAbsence.findMany({
    where: { studentId },
    include: {
      lesson: {
        select: {
          id: true,
          lessonDate: true,
          startTime: true,
          group: { select: { id: true, publicId: true } },
        },
      },
      reason: { select: { name: true, isOther: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type StudentExcusedAbsence = Awaited<
  ReturnType<typeof getStudentExcusedAbsences>
>[number];

/**
 * Get active excused absence reasons for the dropdown.
 */
export async function getExcusedAbsenceReasons() {
  return prisma.excusedAbsenceReason.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, isOther: true },
  });
}

/**
 * Get eligible lessons for excused absence creation.
 * Returns COMPLETED lessons from the student's active group memberships,
 * excluding lessons that already have an excused absence for this student.
 * Filters out replacement lessons (originalLessonId != null) to prevent double-subtraction.
 */
export async function getEligibleLessonsForExcuse(studentId: string) {
  const memberships = await prisma.groupMembership.findMany({
    where: {
      studentId,
      leaveDate: null,
    },
    select: {
      id: true,
      groupId: true,
      joinDate: true,
      group: { select: { publicId: true } },
    },
  });

  if (memberships.length === 0) return [];

  const existingExcuses = await prisma.excusedAbsence.findMany({
    where: { studentId },
    select: { lessonId: true },
  });
  const excusedLessonIds = new Set(existingExcuses.map((e) => e.lessonId));

  const result: Array<{
    lessonId: string;
    lessonDate: Date;
    startTime: string;
    groupPublicId: string;
    groupMembershipId: string;
  }> = [];

  for (const m of memberships) {
    const lessons = await prisma.lesson.findMany({
      where: {
        groupId: m.groupId,
        status: "COMPLETED",
        lessonDate: { gte: m.joinDate },
        originalLessonId: null,
      },
      select: {
        id: true,
        lessonDate: true,
        startTime: true,
      },
      orderBy: { lessonDate: "desc" },
      take: 30,
    });

    for (const l of lessons) {
      if (!excusedLessonIds.has(l.id)) {
        result.push({
          lessonId: l.id,
          lessonDate: l.lessonDate,
          startTime: l.startTime,
          groupPublicId: m.group.publicId,
          groupMembershipId: m.id,
        });
      }
    }
  }

  result.sort((a, b) => b.lessonDate.getTime() - a.lessonDate.getTime());
  return result;
}
