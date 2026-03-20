import { prisma } from "@/server/db";

export async function getStudents() {
  return prisma.student.findMany({
    include: {
      family: { select: { id: true, parentFirstName: true, parentLastName: true, parentPhone: true } },
      groupMemberships: {
        where: { leaveDate: null },
        select: {
          id: true,
          group: { select: { id: true, publicId: true, type: true, level: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getStudentById(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      family: true,
      lostReason: true,
      activatedBy: { select: { firstName: true, lastName: true } },
      inactivatedBy: { select: { firstName: true, lastName: true } },
      groupMemberships: {
        orderBy: { joinDate: "desc" },
        include: {
          group: {
            select: {
              id: true,
              publicId: true,
              type: true,
              level: true,
              days: true,
              startTime: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
}

export async function getLostReasons() {
  return prisma.lostReason.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export type LostReason = Awaited<ReturnType<typeof getLostReasons>>[number];

export async function getUncertainStudents() {
  return prisma.student.findMany({
    where: {
      isUncertain: true,
      status: "ACTIVE",
    },
    include: {
      groupMemberships: {
        where: { leaveDate: null },
        select: {
          id: true,
          group: { select: { id: true, publicId: true, type: true, level: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUncertainCount() {
  return prisma.student.count({
    where: { isUncertain: true, status: "ACTIVE" },
  });
}

/** Students available for group assignment — excludes inactive and those already active in the given group */
export async function getStudentsForGroupAssignment(groupId: string) {
  return prisma.student.findMany({
    where: {
      status: { not: "INACTIVE" },
      groupMemberships: {
        none: {
          groupId,
          leaveDate: null,
        },
      },
    },
    select: {
      id: true,
      crmCode: true,
      firstName: true,
      lastName: true,
      status: true,
    },
    orderBy: { crmCode: "asc" },
  });
}
