"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { groupCreateSchema, groupEditSchema } from "@/schemas/group";
import {
  calculateEndDate,
  generateLessonDates,
  getLevelCategory,
} from "@/lib/helpers/lesson-generation";

export async function createGroup(data: unknown) {
  await requireAdmin();
  const parsed = groupCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const {
    type,
    teacherId,
    days,
    startTime,
    durationMinutes,
    level,
    maxStudents,
    startDate: startDateStr,
    zoomLink,
  } = parsed.data;

  // Teacher rate guard: reject if teacher has no rate history
  const rateCount = await prisma.teacherRateChange.count({
    where: { teacherId },
  });
  if (rateCount === 0) {
    return {
      error:
        "This teacher has no rate history. Add a rate entry before creating a group.",
    };
  }

  const startDate = new Date(startDateStr + "T00:00:00Z");
  const endDate = calculateEndDate(startDate);

  // Get holidays for lesson generation
  const holidays = await prisma.holiday.findMany({
    select: { date: true },
  });
  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0]!),
  );

  const lessonDates = generateLessonDates(startDate, endDate, days, holidayDates);

  if (lessonDates.length === 0) {
    return { error: "No lessons could be generated for the given date range and day pattern." };
  }

  // Pre-check double-booking: batch query TeacherScheduleSlot for teacher+dates+startTime
  const existingSlots = await prisma.teacherScheduleSlot.findMany({
    where: {
      teacherId,
      startTime,
      date: { in: lessonDates },
    },
    include: {
      group: { select: { publicId: true } },
    },
  });

  if (existingSlots.length > 0) {
    const conflicts = existingSlots
      .slice(0, 3)
      .map(
        (s) =>
          `${s.date.toISOString().split("T")[0]} (${s.group.publicId})`,
      )
      .join(", ");
    return {
      error: `Teacher is already scheduled at ${startTime} on: ${conflicts}${existingSlots.length > 3 ? ` and ${existingSlots.length - 3} more` : ""}`,
    };
  }

  // Single interactive transaction for the cascade
  const group = await prisma.$transaction(async (tx) => {
    // 1. Create Group
    const newGroup = await tx.group.create({
      data: {
        type,
        teacherId,
        days,
        startTime,
        durationMinutes,
        level,
        maxStudents,
        startDate,
        endDate,
        zoomLink,
      },
    });

    // 2. Create Lessons via createManyAndReturn
    const lessonData = lessonDates.map((date, index) => ({
      groupId: newGroup.id,
      teacherId,
      originalTeacherId: teacherId,
      lessonNumber: index + 1,
      lessonDate: date,
      startTime,
    }));

    const lessons = await tx.lesson.createManyAndReturn({
      data: lessonData,
    });

    // 3. Create TeacherScheduleSlots from lesson IDs
    await tx.teacherScheduleSlot.createMany({
      data: lessons.map((lesson) => ({
        teacherId,
        date: lesson.lessonDate,
        startTime,
        groupId: newGroup.id,
        lessonId: lesson.id,
      })),
    });

    // 4. Create GroupTeacherHistory (initial, no changedById)
    await tx.groupTeacherHistory.create({
      data: {
        groupId: newGroup.id,
        teacherId,
        startDate,
      },
    });

    return newGroup;
  });

  redirect(`/groups/${group.id}`);
}

export async function updateGroup(id: string, data: unknown) {
  await requireAdmin();
  const parsed = groupEditSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { startTime, maxStudents, zoomLink, skipAutoGraduation } = parsed.data;

  // Get current group to check if startTime changed
  const currentGroup = await prisma.group.findUnique({
    where: { id },
    select: { startTime: true },
  });

  if (!currentGroup) {
    return { error: "Group not found" };
  }

  const startTimeChanged = currentGroup.startTime !== startTime;

  if (startTimeChanged) {
    // C#13: Cascade startTime update to future SCHEDULED lessons + swap schedule slots
    await prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id },
        data: { maxStudents, startTime, zoomLink, skipAutoGraduation },
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Update future SCHEDULED lessons' startTime
      const futureLessons = await tx.lesson.findMany({
        where: {
          groupId: id,
          status: "SCHEDULED",
          lessonDate: { gte: today },
        },
        select: { id: true },
      });

      if (futureLessons.length > 0) {
        const lessonIds = futureLessons.map((l) => l.id);

        await tx.lesson.updateMany({
          where: { id: { in: lessonIds } },
          data: { startTime },
        });

        // Update corresponding schedule slots
        await tx.teacherScheduleSlot.updateMany({
          where: { lessonId: { in: lessonIds } },
          data: { startTime },
        });
      }
    });
  } else {
    // Simple update, no cascade needed
    await prisma.group.update({
      where: { id },
      data: { maxStudents, startTime, zoomLink, skipAutoGraduation },
    });
  }

  revalidatePath(`/groups/${id}`);
  redirect(`/groups/${id}`);
}
