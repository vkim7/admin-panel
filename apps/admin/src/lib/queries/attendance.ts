import { prisma } from "@/server/db";

export async function getAttendanceForGroup(groupId: string) {
  return prisma.attendance.findMany({
    where: { groupId },
    include: {
      lesson: {
        select: { id: true, lessonNumber: true, lessonDate: true },
      },
      student: {
        select: { id: true, crmCode: true, firstName: true, lastName: true },
      },
    },
    orderBy: { lesson: { lessonDate: "asc" } },
  });
}

export type AttendanceRecord = Awaited<ReturnType<typeof getAttendanceForGroup>>[number];

export async function getLessonAttendanceStatus(groupId: string) {
  const records = await prisma.attendance.findMany({
    where: { groupId },
    select: { lessonId: true },
    distinct: ["lessonId"],
  });
  return records.map((r) => r.lessonId);
}
