import { prisma } from "@/server/db";

export async function getExams(year: number, month: number) {
  return prisma.exam.findMany({
    where: {
      scheduledDate: {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      },
      group: { isActive: true },
    },
    include: {
      group: {
        select: {
          id: true,
          publicId: true,
          level: true,
          days: true,
          startTime: true,
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { scheduledDate: "asc" },
  });
}

export type ExamWithGroup = Awaited<ReturnType<typeof getExams>>[number];
