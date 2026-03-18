"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { teacherUnavailabilitySchema } from "@/schemas/teacher-unavailability";
import { timeRangesOverlap, timeToMinutes } from "@/lib/helpers/lesson-scheduling";

export async function recordTeacherUnavailability(data: unknown) {
  const admin = await requireAdmin();
  const parsed = teacherUnavailabilitySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { teacherId, date: dateStr, startTime, endTime, reason } = parsed.data;
  const date = new Date(dateStr + "T00:00:00Z");

  // C#20a: Overlap validation — check existing unavailability for same teacher+date
  const existing = await prisma.teacherUnavailability.findMany({
    where: { teacherId, date },
  });

  for (const ua of existing) {
    if (timeRangesOverlap(startTime, endTime, ua.startTime, ua.endTime)) {
      return { error: "Overlaps with an existing unavailability entry on this date" };
    }
  }

  // Create the unavailability record
  await prisma.teacherUnavailability.create({
    data: {
      teacherId,
      date,
      startTime,
      endTime,
      reason,
      createdById: admin.id,
    },
  });

  // C#28: Auto-detection — find SCHEDULED lessons for this teacher on this date
  const affectedLessons = await prisma.lesson.findMany({
    where: {
      teacherId,
      lessonDate: date,
      status: "SCHEDULED",
    },
    select: {
      id: true,
      startTime: true,
      groupId: true,
      group: { select: { durationMinutes: true } },
    },
  });

  const lessonIdsToMark: string[] = [];
  const groupIds = new Set<string>();

  for (const lesson of affectedLessons) {
    if (startTime === null) {
      // Whole-day unavailability affects all lessons
      lessonIdsToMark.push(lesson.id);
      groupIds.add(lesson.groupId);
    } else {
      // Partial-day: check time overlap
      const lessonStartMin = timeToMinutes(lesson.startTime);
      const lessonEndMin = lessonStartMin + lesson.group.durationMinutes;
      const uaStartMin = timeToMinutes(startTime);
      const uaEndMin = endTime ? timeToMinutes(endTime) : 1440;

      if (lessonStartMin < uaEndMin && uaStartMin < lessonEndMin) {
        lessonIdsToMark.push(lesson.id);
        groupIds.add(lesson.groupId);
      }
    }
  }

  if (lessonIdsToMark.length > 0) {
    await prisma.lesson.updateMany({
      where: { id: { in: lessonIdsToMark } },
      data: {
        status: "PENDING_RESOLUTION",
        pendingAt: new Date(),
      },
    });
  }

  revalidatePath(`/teachers/${teacherId}`);
  for (const gId of groupIds) {
    revalidatePath(`/groups/${gId}`);
  }
  revalidatePath("/schedule");
  revalidatePath("/pending-lessons");

  return {
    success: true,
    affectedLessons: lessonIdsToMark.length,
  };
}

export async function deleteTeacherUnavailability(id: string) {
  await requireAdmin();

  const record = await prisma.teacherUnavailability.findUnique({
    where: { id },
    select: { teacherId: true },
  });

  if (!record) return { error: "Record not found" };

  await prisma.teacherUnavailability.delete({ where: { id } });

  revalidatePath(`/teachers/${record.teacherId}`);
  return { success: true };
}
