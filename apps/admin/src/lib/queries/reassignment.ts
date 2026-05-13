import { prisma } from "@/server/db";

export async function getReassignmentStudents() {
  return prisma.student.findMany({
    where: { status: "AWAITING_REASSIGNMENT" },
    select: {
      id: true,
      crmCode: true,
      firstName: true,
      lastName: true,
      phone: true,
      level: true,
      progressStage: true,
      createdAt: true,
      preferredDays: true,
      preferredTimeSlots: true,
      preferredLanguage: true,
      preferredLessonType: true,
      comment: true,
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
    orderBy: { createdAt: "asc" }, // longest-waiting first
  });
}

export type ReassignmentStudent = Awaited<ReturnType<typeof getReassignmentStudents>>[number];

export async function getReassignmentCount() {
  return prisma.student.count({
    where: { status: "AWAITING_REASSIGNMENT" },
  });
}

export async function getOrphanedStudents() {
  return prisma.student.findMany({
    where: {
      status: "ACTIVE",
      groupMemberships: { none: { leaveDate: null } },
    },
    select: {
      id: true,
      crmCode: true,
      firstName: true,
      lastName: true,
      phone: true,
      level: true,
    },
  });
}

export type OrphanedStudent = Awaited<ReturnType<typeof getOrphanedStudents>>[number];
