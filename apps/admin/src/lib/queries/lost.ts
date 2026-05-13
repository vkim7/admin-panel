import { prisma } from "@/server/db";

export async function getLostStudents() {
  return prisma.student.findMany({
    where: { status: "INACTIVE" },
    select: {
      id: true,
      crmCode: true,
      firstName: true,
      lastName: true,
      phone: true,
      level: true,
      progressStage: true,
      inactivatedAt: true,
      otherLostReason: true,
      preferredDays: true,
      preferredTimeSlots: true,
      preferredLanguage: true,
      preferredLessonType: true,
      lostReason: { select: { id: true, name: true } },
      inactivatedBy: { select: { firstName: true, lastName: true } },
      groupMemberships: {
        where: { leaveDate: { not: null } },
        orderBy: { leaveDate: "desc" },
        take: 1,
        select: {
          leaveDate: true,
          group: { select: { id: true, publicId: true } },
        },
      },
    },
    orderBy: { inactivatedAt: "desc" },
  });
}

export type LostStudent = Awaited<ReturnType<typeof getLostStudents>>[number];

export async function getLostCount() {
  return prisma.student.count({
    where: { status: "INACTIVE" },
  });
}
