import { prisma } from "@/server/db";

export async function getGroups() {
  return prisma.group.findMany({
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      memberships: {
        where: { leaveDate: null },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGroupById(id: string) {
  return prisma.group.findUnique({
    where: { id },
    include: {
      teacher: {
        select: { id: true, firstName: true, lastName: true },
      },
      memberships: {
        orderBy: { joinDate: "asc" },
        include: {
          student: {
            select: {
              id: true,
              crmCode: true,
              firstName: true,
              lastName: true,
              phone: true,
              dateOfBirth: true,
              status: true,
              isUncertain: true,
              uncertainReason: { select: { name: true } },
            },
          },
          paymentPeriods: {
            select: {
              periodYear: true,
              periodMonth: true,
              amountDue: true,
              discountAmount: true,
              amountPaid: true,
              paymentStatus: true,
            },
          },
        },
      },
      teacherHistory: {
        orderBy: { startDate: "desc" },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
          changedBy: { select: { firstName: true, lastName: true } },
        },
      },
      lessons: {
        select: {
          id: true,
          status: true,
          lessonDate: true,
        },
      },
      exams: {
        select: {
          id: true,
          type: true,
          scheduledDate: true,
        },
        orderBy: { scheduledDate: "asc" },
      },
    },
  });
}

export async function getTeachersForGroupForm() {
  return prisma.teacher.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      rateChanges: {
        select: { id: true },
        take: 1,
      },
      availability: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
    orderBy: { firstName: "asc" },
  });
}

export async function getHolidays() {
  return prisma.holiday.findMany({
    select: { date: true },
  });
}
