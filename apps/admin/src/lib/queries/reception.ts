import { prisma } from "@/server/db";

export async function getReceptionStudents() {
  return prisma.student.findMany({
    where: { status: "AWAITING_ASSIGNMENT" },
    select: {
      id: true,
      crmCode: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      level: true,
      progressStage: true,
      createdAt: true,
      preferredDays: true,
      preferredTimeSlots: true,
      preferredLanguage: true,
      comment: true,
      family: { select: { parentPhone: true } },
    },
    orderBy: { createdAt: "asc" }, // oldest first — longest-waiting students at top
  });
}

export async function getReceptionCount() {
  return prisma.student.count({
    where: { status: "AWAITING_ASSIGNMENT" },
  });
}

/** Active groups with available seats, for the assign-to-group dialog */
export async function getGroupsForAssignment() {
  const groups = await prisma.group.findMany({
    where: { isActive: true },
    include: {
      teacher: {
        select: {
          firstName: true,
          lastName: true,
          teachingLanguage: true,
        },
      },
      memberships: {
        where: { leaveDate: null },
        select: { id: true },
      },
    },
    orderBy: [{ level: "asc" }, { startTime: "asc" }],
  });

  return groups
    .filter((g) => g.memberships.length < g.maxStudents)
    .map((g) => ({
      id: g.id,
      publicId: g.publicId,
      type: g.type,
      level: g.level,
      progressStage: g.progressStage,
      days: g.days,
      startTime: g.startTime,
      teacherName: `${g.teacher.firstName} ${g.teacher.lastName}`,
      teachingLanguage: g.teacher.teachingLanguage,
      availableSeats: g.maxStudents - g.memberships.length,
      maxStudents: g.maxStudents,
    }));
}
