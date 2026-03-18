"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import {
  initializeAttendanceSchema,
  toggleAttendanceSchema,
} from "@/schemas/attendance";

// ─── Initialize Attendance (C#18) ───────────────────────────────────────────

export async function initializeAttendance(data: unknown) {
  await requireAdmin();
  const parsed = initializeAttendanceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    select: { id: true, status: true, groupId: true, lessonDate: true },
  });

  if (!lesson) return { error: "Lesson not found" };
  if (lesson.status !== "SCHEDULED" && lesson.status !== "COMPLETED") {
    return { error: "Attendance can only be taken for scheduled or completed lessons" };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (lesson.lessonDate > today) {
    return { error: "Attendance can only be taken for today's or past lessons" };
  }

  // Idempotency: if records already exist, no-op
  const existing = await prisma.attendance.count({
    where: { lessonId: lesson.id },
  });
  if (existing > 0) {
    revalidatePath(`/groups/${lesson.groupId}`);
    return { success: true };
  }

  // Get active memberships at time of lesson
  const members = await prisma.groupMembership.findMany({
    where: {
      groupId: lesson.groupId,
      leaveDate: null,
      joinDate: { lte: lesson.lessonDate },
    },
    select: { studentId: true },
  });

  if (members.length === 0) {
    return { error: "No active students found for this lesson" };
  }

  await prisma.attendance.createMany({
    data: members.map((m) => ({
      lessonId: lesson.id,
      studentId: m.studentId,
      groupId: lesson.groupId,
      isAbsent: false,
    })),
  });

  revalidatePath(`/groups/${lesson.groupId}`);
  return { success: true };
}

// ─── Toggle Attendance (C#30) ───────────────────────────────────────────────

export async function toggleAttendance(data: unknown) {
  await requireAdmin();
  const parsed = toggleAttendanceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const record = await prisma.attendance.findUnique({
    where: { id: parsed.data.attendanceId },
    select: { id: true, groupId: true },
  });

  if (!record) return { error: "Attendance record not found" };

  await prisma.attendance.update({
    where: { id: record.id },
    data: { isAbsent: parsed.data.isAbsent },
  });

  revalidatePath(`/groups/${record.groupId}`);
  return { success: true };
}
