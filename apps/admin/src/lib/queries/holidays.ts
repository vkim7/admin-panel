import { prisma } from "@/server/db";

export async function getHolidaysByYear(year: number) {
  return prisma.holiday.findMany({
    where: {
      date: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    select: {
      id: true,
      date: true,
      name: true,
      createdAt: true,
    },
    orderBy: { date: "asc" },
  });
}

export type HolidayRow = Awaited<ReturnType<typeof getHolidaysByYear>>[number];
