import { prisma } from "@/server/db";

export async function getTeachers() {
  return prisma.teacher.findMany({
    where: { isActive: true },
    include: {
      groups: { where: { isActive: true }, select: { id: true, type: true } },
    },
    orderBy: { firstName: "asc" },
  });
}

export async function getAllTeachers(includeInactive = false) {
  return prisma.teacher.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      groups: { where: { isActive: true }, select: { id: true, type: true } },
    },
    orderBy: { firstName: "asc" },
  });
}

export async function getTeacherById(id: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      rateChanges: { orderBy: { effectiveFrom: "desc" }, include: { changedBy: { select: { firstName: true, lastName: true } } } },
      groups: {
        where: { isActive: true },
        select: {
          id: true,
          publicId: true,
          type: true,
          level: true,
          days: true,
          startTime: true,
          memberships: { where: { leaveDate: null }, select: { id: true } },
        },
      },
      deactivatedBy: { select: { firstName: true, lastName: true } },
    },
  });

  return teacher;
}
