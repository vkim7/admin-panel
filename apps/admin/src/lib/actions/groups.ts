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
import { calculateExamDates } from "@/lib/helpers/exam-calculation";
import { createZoomMeeting, updateZoomMeeting, deleteZoomMeeting, getZoomStartUrl } from "@/lib/zoom";

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
    level,
    startDate: startDateStr,
  } = parsed.data;

  const durationMinutes = 80;
  const maxStudents = type === "GROUP" ? 12 : 1;

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

    // 5. Create Exam records (mid + final)
    const examDates = calculateExamDates(lessons);
    if (examDates) {
      await tx.exam.createMany({
        data: [
          { groupId: newGroup.id, type: "MID", scheduledDate: examDates.mid },
          { groupId: newGroup.id, type: "FINAL", scheduledDate: examDates.final },
        ],
      });
    }

    return newGroup;
  });

  // Best-effort: create Zoom meeting after DB transaction
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { zoomEmail: true, firstName: true, lastName: true },
  });

  if (teacher?.zoomEmail) {
    const zoomResult = await createZoomMeeting({
      zoomEmail: teacher.zoomEmail,
      topic: `${group.publicId} - ${teacher.firstName} ${teacher.lastName}`,
      startTime,
      durationMinutes,
      days,
      startDate,
      endDate,
    });
    if (zoomResult) {
      await prisma.group.update({
        where: { id: group.id },
        data: {
          zoomMeetingId: zoomResult.meetingId,
          zoomJoinUrl: zoomResult.joinUrl,
        },
      });
    }
  }

  revalidatePath("/exams");
  redirect(`/groups/${group.id}`);
}

export async function updateGroup(id: string, data: unknown) {
  await requireAdmin();
  const parsed = groupEditSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { startTime, skipAutoGraduation } = parsed.data;

  // Get current group to check if startTime changed
  const currentGroup = await prisma.group.findUnique({
    where: { id },
    select: { startTime: true, startDate: true, zoomMeetingId: true },
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
        data: { startTime, skipAutoGraduation },
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
      data: { startTime, skipAutoGraduation },
    });
  }

  // Best-effort: update Zoom meeting if startTime changed
  if (startTimeChanged && currentGroup.zoomMeetingId) {
    await updateZoomMeeting(currentGroup.zoomMeetingId, { startTime, startDate: currentGroup.startDate });
  }

  revalidatePath(`/groups/${id}`);
  redirect(`/groups/${id}`);
}

export async function createGroupZoomMeeting(groupId: string) {
  await requireAdmin();

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      publicId: true,
      isActive: true,
      zoomMeetingId: true,
      days: true,
      startTime: true,
      durationMinutes: true,
      startDate: true,
      endDate: true,
      teacher: { select: { zoomEmail: true, firstName: true, lastName: true } },
    },
  });

  if (!group) return { error: "Group not found" };
  if (!group.isActive) return { error: "Group is not active" };
  if (group.zoomMeetingId) return { error: "Group already has a Zoom meeting" };
  if (!group.teacher.zoomEmail) {
    return { error: "Teacher has no Zoom email configured. Add it in the teacher profile first." };
  }

  const zoomResult = await createZoomMeeting({
    zoomEmail: group.teacher.zoomEmail,
    topic: `${group.publicId} - ${group.teacher.firstName} ${group.teacher.lastName}`,
    startTime: group.startTime,
    durationMinutes: group.durationMinutes,
    days: group.days,
    startDate: group.startDate,
    endDate: group.endDate,
  });

  if (!zoomResult) {
    return { error: "Failed to create Zoom meeting. Check Zoom credentials and try again." };
  }

  await prisma.group.update({
    where: { id: groupId },
    data: {
      zoomMeetingId: zoomResult.meetingId,
      zoomJoinUrl: zoomResult.joinUrl,
    },
  });

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function getZoomHostUrl(groupId: string): Promise<{ url?: string; error?: string }> {
  await requireAdmin();

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { zoomMeetingId: true },
  });

  if (!group?.zoomMeetingId) {
    return { error: "No Zoom meeting configured for this group" };
  }

  const url = await getZoomStartUrl(group.zoomMeetingId);
  if (!url) {
    return { error: "Failed to get host URL from Zoom" };
  }

  return { url };
}
