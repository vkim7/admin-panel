"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import {
  completeLessonSchema,
  cancelLessonSchema,
  assignSubstituteSchema,
  offlineRescheduleSchema,
  studentCancelLessonSchema,
} from "@/schemas/lesson";
import { permanentTeacherChangeSchema } from "@/schemas/teacher-change";
import { findNextValidDate, timeToMinutes } from "@/lib/helpers/lesson-scheduling";
import type { PrismaClient } from "@eng/database";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// ─── Complete Lesson (C#37) ─────────────────────────────────────────────────

export async function completeLesson(data: unknown) {
  await requireAdmin();
  const parsed = completeLessonSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    select: {
      id: true,
      status: true,
      lessonDate: true,
      groupId: true,
    },
  });

  if (!lesson) return { error: "Lesson not found" };
  if (lesson.status !== "SCHEDULED") {
    return { error: "Only scheduled lessons can be completed" };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (lesson.lessonDate > today) {
    return { error: "Cannot complete a future lesson" };
  }

  // C#37: Snapshot activeStudentCount as of lesson date
  const activeStudentCount = await prisma.groupMembership.count({
    where: {
      groupId: lesson.groupId,
      leaveDate: null,
      joinDate: { lte: lesson.lessonDate },
    },
  });

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      activeStudentCount,
    },
  });

  revalidatePath(`/groups/${lesson.groupId}`);
  return { success: true };
}

// ─── Internal: Perform Cancellation + Replacement (C#9) ─────────────────────

async function performCancellation(
  tx: Tx,
  lessonId: string,
  adminId: string,
  cancellationReasonId: string,
  otherReason?: string | null,
) {
  // 1. Get the lesson with group info
  const lesson = await tx.lesson.findUnique({
    where: { id: lessonId },
    include: {
      group: {
        select: {
          id: true,
          days: true,
          endDate: true,
          startTime: true,
          teacherId: true,
          durationMinutes: true,
        },
      },
    },
  });

  if (!lesson) throw new Error("Lesson not found");

  // 2. Cancel the lesson
  await tx.lesson.update({
    where: { id: lessonId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById: adminId,
      cancellationReasonId,
      otherCancellationReason: otherReason ?? null,
      pendingAt: null,
    },
  });

  // 3. Delete schedule slot for cancelled lesson
  await tx.teacherScheduleSlot.deleteMany({
    where: { lessonId },
  });

  // 4. Find next valid date after group endDate
  const holidays = await tx.holiday.findMany({ select: { date: true } });
  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0]!),
  );

  const replacementDate = findNextValidDate(
    lesson.group.endDate,
    lesson.group.days,
    holidayDates,
  );

  if (!replacementDate) {
    throw new Error("Could not find a valid replacement date within 60 days");
  }

  // 5. Determine replacement lesson number
  const maxLesson = await tx.lesson.aggregate({
    where: { groupId: lesson.groupId },
    _max: { lessonNumber: true },
  });
  const replacementNumber = (maxLesson._max.lessonNumber ?? 0) + 1;

  // 6. Chain root propagation: copy originalLessonId from cancelled, or use cancelled's ID
  const originalLessonId = lesson.originalLessonId ?? lesson.id;

  // 7. Create replacement lesson (using group's current teacher)
  const replacement = await tx.lesson.create({
    data: {
      groupId: lesson.groupId,
      teacherId: lesson.group.teacherId,
      originalTeacherId: lesson.group.teacherId,
      lessonNumber: replacementNumber,
      lessonDate: replacementDate,
      startTime: lesson.group.startTime,
      rescheduledFromId: lesson.id,
      originalLessonId,
    },
  });

  // 8. Create schedule slot for replacement
  await tx.teacherScheduleSlot.create({
    data: {
      teacherId: lesson.group.teacherId,
      date: replacementDate,
      startTime: lesson.group.startTime,
      groupId: lesson.groupId,
      lessonId: replacement.id,
    },
  });

  // 9. Update group endDate
  await tx.group.update({
    where: { id: lesson.groupId },
    data: { endDate: replacementDate },
  });

  return replacement;
}

// ─── Cancel Lesson ──────────────────────────────────────────────────────────

export async function cancelLesson(data: unknown) {
  const admin = await requireAdmin();
  const parsed = cancelLessonSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { lessonId, cancellationReasonId, otherCancellationReason } = parsed.data;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, status: true, groupId: true },
  });

  if (!lesson) return { error: "Lesson not found" };
  if (lesson.status !== "SCHEDULED" && lesson.status !== "PENDING_RESOLUTION") {
    return { error: "This lesson cannot be cancelled" };
  }

  // Validate reason
  const reason = await prisma.cancellationReason.findUnique({
    where: { id: cancellationReasonId },
  });
  if (!reason) return { error: "Invalid cancellation reason" };
  if (reason.isOther && !otherCancellationReason?.trim()) {
    return { error: "Please specify a reason" };
  }

  await prisma.$transaction(async (tx) => {
    await performCancellation(
      tx,
      lessonId,
      admin.id,
      cancellationReasonId,
      otherCancellationReason,
    );
  });

  revalidatePath(`/groups/${lesson.groupId}`);
  revalidatePath("/schedule");
  revalidatePath("/pending-lessons");
  return { success: true };
}

// ─── Assign Substitute (C#29) ───────────────────────────────────────────────

export async function assignSubstitute(data: unknown) {
  await requireAdmin();
  const parsed = assignSubstituteSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { lessonId, substituteTeacherId } = parsed.data;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      group: { select: { id: true, durationMinutes: true } },
    },
  });

  if (!lesson) return { error: "Lesson not found" };
  if (lesson.status !== "PENDING_RESOLUTION") {
    return { error: "Only pending lessons can have substitutes assigned" };
  }

  // Validate substitute: no schedule conflict
  const lessonStart = timeToMinutes(lesson.startTime);
  const lessonEnd = lessonStart + lesson.group.durationMinutes;

  const existingSlots = await prisma.teacherScheduleSlot.findMany({
    where: {
      teacherId: substituteTeacherId,
      date: lesson.lessonDate,
    },
    select: { startTime: true, group: { select: { durationMinutes: true } } },
  });

  for (const slot of existingSlots) {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = slotStart + slot.group.durationMinutes;
    if (lessonStart < slotEnd && slotStart < lessonEnd) {
      return { error: "Substitute teacher has a schedule conflict at this time" };
    }
  }

  // Check unavailability
  const unavailabilities = await prisma.teacherUnavailability.findMany({
    where: {
      teacherId: substituteTeacherId,
      date: lesson.lessonDate,
    },
  });

  for (const ua of unavailabilities) {
    if (ua.startTime === null) {
      return { error: "Substitute teacher is unavailable on this date" };
    }
    const uaStart = timeToMinutes(ua.startTime);
    const uaEnd = ua.endTime ? timeToMinutes(ua.endTime) : 1440;
    if (lessonStart < uaEnd && uaStart < lessonEnd) {
      return { error: "Substitute teacher is unavailable at this time" };
    }
  }

  await prisma.$transaction(async (tx) => {
    // Update lesson: swap teacher, back to SCHEDULED
    await tx.lesson.update({
      where: { id: lessonId },
      data: {
        teacherId: substituteTeacherId,
        status: "SCHEDULED",
        pendingAt: null,
      },
    });

    // Swap schedule slot
    await tx.teacherScheduleSlot.deleteMany({ where: { lessonId } });
    await tx.teacherScheduleSlot.create({
      data: {
        teacherId: substituteTeacherId,
        date: lesson.lessonDate,
        startTime: lesson.startTime,
        groupId: lesson.groupId,
        lessonId,
      },
    });
  });

  revalidatePath(`/groups/${lesson.groupId}`);
  revalidatePath("/schedule");
  revalidatePath("/pending-lessons");
  return { success: true };
}

// ─── Student Cancel Lesson (C#26) ──────────────────────────────────────────

export async function studentCancelLesson(data: unknown) {
  const admin = await requireAdmin();
  const parsed = studentCancelLessonSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    include: {
      group: { select: { id: true, type: true, days: true, endDate: true, startTime: true, teacherId: true, durationMinutes: true } },
    },
  });

  if (!lesson) return { error: "Lesson not found" };
  if (lesson.group.type !== "INDIVIDUAL") {
    return { error: "Student cancellation is only for individual lessons" };
  }
  if (lesson.status !== "SCHEDULED") {
    return { error: "Only scheduled lessons can be cancelled" };
  }

  // C#26: 24h advance notice
  const now = new Date();
  const lessonDateTime = new Date(lesson.lessonDate);
  const [hours, minutes] = lesson.startTime.split(":").map(Number);
  lessonDateTime.setUTCHours(hours!, minutes!, 0, 0);
  const hoursUntilLesson = (lessonDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilLesson < 24) {
    return { error: "Student cancellations require at least 24 hours advance notice" };
  }

  // C#26: Monthly limit (2 per month)
  const lessonYear = lesson.lessonDate.getUTCFullYear();
  const lessonMonth = lesson.lessonDate.getUTCMonth() + 1;
  const startOfMonth = new Date(Date.UTC(lessonYear, lessonMonth - 1, 1));
  const endOfMonth = new Date(Date.UTC(lessonYear, lessonMonth, 0));

  const cancellationCount = await prisma.lesson.count({
    where: {
      groupId: lesson.groupId,
      status: "CANCELLED",
      lessonDate: { gte: startOfMonth, lte: endOfMonth },
      cancellationReason: { name: "Student request" },
    },
  });

  if (cancellationCount >= 2) {
    return { error: "Monthly student cancellation limit reached (2 per month)" };
  }

  // Find "Student request" cancellation reason
  const studentRequestReason = await prisma.cancellationReason.findFirst({
    where: { name: "Student request" },
  });

  if (!studentRequestReason) {
    return { error: "Student request cancellation reason not found in system" };
  }

  await prisma.$transaction(async (tx) => {
    await performCancellation(
      tx,
      lesson.id,
      admin.id,
      studentRequestReason.id,
    );
  });

  revalidatePath(`/groups/${lesson.groupId}`);
  revalidatePath("/schedule");
  return { success: true, cancellationsUsed: cancellationCount + 1 };
}

// ─── Offline Reschedule (C#27) ──────────────────────────────────────────────

export async function offlineRescheduleLesson(data: unknown) {
  await requireAdmin();
  const parsed = offlineRescheduleSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { lessonId, newDate: newDateStr, newStartTime } = parsed.data;
  const newDate = new Date(newDateStr + "T00:00:00Z");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      group: { select: { id: true, type: true, durationMinutes: true } },
    },
  });

  if (!lesson) return { error: "Lesson not found" };
  if (lesson.group.type !== "INDIVIDUAL") {
    return { error: "Offline reschedule is only for individual lessons" };
  }
  if (lesson.status !== "SCHEDULED") {
    return { error: "Only scheduled lessons can be rescheduled" };
  }

  // Check teacher schedule conflict at new date/time
  const lessonStart = timeToMinutes(newStartTime);
  const lessonEnd = lessonStart + lesson.group.durationMinutes;

  const existingSlots = await prisma.teacherScheduleSlot.findMany({
    where: {
      teacherId: lesson.teacherId,
      date: newDate,
      NOT: { lessonId },
    },
    select: { startTime: true, group: { select: { durationMinutes: true } } },
  });

  for (const slot of existingSlots) {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = slotStart + slot.group.durationMinutes;
    if (lessonStart < slotEnd && slotStart < lessonEnd) {
      return { error: "Teacher has a schedule conflict at the new time" };
    }
  }

  // Check teacher unavailability
  const unavailabilities = await prisma.teacherUnavailability.findMany({
    where: { teacherId: lesson.teacherId, date: newDate },
  });

  for (const ua of unavailabilities) {
    if (ua.startTime === null) {
      return { error: "Teacher is unavailable on the new date" };
    }
    const uaStart = timeToMinutes(ua.startTime);
    const uaEnd = ua.endTime ? timeToMinutes(ua.endTime) : 1440;
    if (lessonStart < uaEnd && uaStart < lessonEnd) {
      return { error: "Teacher is unavailable at the new time" };
    }
  }

  await prisma.$transaction(async (tx) => {
    // Save original date/time before updating
    await tx.lesson.update({
      where: { id: lessonId },
      data: {
        originalDate: lesson.originalDate ?? lesson.lessonDate,
        originalStartTime: lesson.originalStartTime ?? lesson.startTime,
        lessonDate: newDate,
        startTime: newStartTime,
      },
    });

    // Swap schedule slot
    await tx.teacherScheduleSlot.deleteMany({ where: { lessonId } });
    await tx.teacherScheduleSlot.create({
      data: {
        teacherId: lesson.teacherId,
        date: newDate,
        startTime: newStartTime,
        groupId: lesson.groupId,
        lessonId,
      },
    });
  });

  revalidatePath(`/groups/${lesson.groupId}`);
  revalidatePath("/schedule");
  return { success: true };
}

// ─── Permanent Teacher Change (C#21) ───────────────────────────────────────

export async function changeGroupTeacher(data: unknown) {
  const admin = await requireAdmin();
  const parsed = permanentTeacherChangeSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { groupId, newTeacherId } = parsed.data;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, teacherId: true, startTime: true, durationMinutes: true },
  });

  if (!group) return { error: "Group not found" };
  if (group.teacherId === newTeacherId) {
    return { error: "New teacher must be different from the current teacher" };
  }

  const newTeacher = await prisma.teacher.findUnique({
    where: { id: newTeacherId },
    select: { isActive: true },
  });

  if (!newTeacher?.isActive) {
    return { error: "New teacher must be active" };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Get all future SCHEDULED lessons
  const futureLessons = await prisma.lesson.findMany({
    where: {
      groupId,
      status: "SCHEDULED",
      lessonDate: { gte: today },
    },
    select: { id: true, lessonDate: true, startTime: true },
  });

  // Check conflicts for new teacher on all future lesson dates
  const lessonStart = timeToMinutes(group.startTime);
  const lessonEnd = lessonStart + group.durationMinutes;

  if (futureLessons.length > 0) {
    const futureDates = futureLessons.map((l) => l.lessonDate);

    const conflictingSlots = await prisma.teacherScheduleSlot.findMany({
      where: {
        teacherId: newTeacherId,
        date: { in: futureDates },
      },
      select: { startTime: true, date: true, group: { select: { durationMinutes: true, publicId: true } } },
    });

    for (const slot of conflictingSlots) {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = slotStart + slot.group.durationMinutes;
      if (lessonStart < slotEnd && slotStart < lessonEnd) {
        const dateStr = slot.date.toISOString().split("T")[0];
        return {
          error: `New teacher has a conflict on ${dateStr} with group ${slot.group.publicId}`,
        };
      }
    }

    // Check unavailability
    const unavailabilities = await prisma.teacherUnavailability.findMany({
      where: {
        teacherId: newTeacherId,
        date: { in: futureDates },
      },
    });

    for (const ua of unavailabilities) {
      if (ua.startTime === null) {
        const dateStr = ua.date.toISOString().split("T")[0];
        return { error: `New teacher is unavailable on ${dateStr}` };
      }
      const uaStart = timeToMinutes(ua.startTime);
      const uaEnd = ua.endTime ? timeToMinutes(ua.endTime) : 1440;
      if (lessonStart < uaEnd && uaStart < lessonEnd) {
        const dateStr = ua.date.toISOString().split("T")[0];
        return { error: `New teacher is unavailable on ${dateStr}` };
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // a. Update Group.teacherId
    await tx.group.update({
      where: { id: groupId },
      data: { teacherId: newTeacherId },
    });

    // b. Close current GroupTeacherHistory
    await tx.groupTeacherHistory.updateMany({
      where: { groupId, endDate: null },
      data: { endDate: today },
    });

    // c. Create new GroupTeacherHistory
    await tx.groupTeacherHistory.create({
      data: {
        groupId,
        teacherId: newTeacherId,
        startDate: today,
        changedById: admin.id,
      },
    });

    // d. Update all future SCHEDULED lessons
    if (futureLessons.length > 0) {
      const lessonIds = futureLessons.map((l) => l.id);

      await tx.lesson.updateMany({
        where: { id: { in: lessonIds } },
        data: {
          teacherId: newTeacherId,
          originalTeacherId: newTeacherId,
        },
      });

      // e. Delete old schedule slots, create new ones
      await tx.teacherScheduleSlot.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });

      await tx.teacherScheduleSlot.createMany({
        data: futureLessons.map((l) => ({
          teacherId: newTeacherId,
          date: l.lessonDate,
          startTime: l.startTime,
          groupId,
          lessonId: l.id,
        })),
      });
    }
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/schedule");
  revalidatePath("/teachers");
  return { success: true };
}
