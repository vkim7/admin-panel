"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { addStudentsSchema, trialResolutionSchema } from "@/schemas/group-membership";
import { getLevelCategory, calculateLessonsStart } from "@/lib/helpers/lesson-generation";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";

function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

export async function addStudentsToGroup(groupId: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = addStudentsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { studentIds, joinDate: joinDateStr, isTrial, comment } = parsed.data;
  const joinDate = new Date(joinDateStr + "T00:00:00Z");

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        where: { leaveDate: null },
        select: { id: true, studentId: true },
      },
      lessons: {
        where: { originalLessonId: null },
        select: { lessonNumber: true, lessonDate: true },
        orderBy: { lessonDate: "asc" },
      },
    },
  });

  if (!group) {
    return { error: "Group not found" };
  }

  // C#3: Capacity check for all students
  const availableSlots = group.maxStudents - group.memberships.length;
  if (studentIds.length > availableSlots) {
    return {
      error: `Not enough capacity. ${availableSlots} slot${availableSlots === 1 ? "" : "s"} available, ${studentIds.length} student${studentIds.length === 1 ? "" : "s"} selected.`,
    };
  }

  // Duplicate check: any students already active in this group
  const existingIds = new Set(group.memberships.map((m) => m.studentId));
  const duplicates = studentIds.filter((id) => existingIds.has(id));
  if (duplicates.length > 0) {
    return { error: `${duplicates.length} student${duplicates.length === 1 ? " is" : "s are"} already active in this group.` };
  }

  // C#40: Schedule conflict detection — check if any student is already in a group
  // with overlapping schedule (same days AND overlapping time window)
  const existingMemberships = await prisma.groupMembership.findMany({
    where: {
      studentId: { in: studentIds },
      leaveDate: null,
      groupId: { not: groupId },
    },
    select: {
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
      group: { select: { publicId: true, days: true, startTime: true, durationMinutes: true } },
    },
  });

  if (existingMemberships.length > 0) {
    const targetStart = timeToMinutes(group.startTime);
    const targetEnd = targetStart + group.durationMinutes;
    const targetDays = new Set(group.days);

    for (const m of existingMemberships) {
      const hasSharedDay = m.group.days.some((d) => targetDays.has(d));
      if (!hasSharedDay) continue;

      const existingStart = timeToMinutes(m.group.startTime);
      const existingEnd = existingStart + m.group.durationMinutes;

      if (targetStart < existingEnd && existingStart < targetEnd) {
        return {
          error: `Student ${m.student.firstName} ${m.student.lastName} is already in group ${m.group.publicId} at this time.`,
        };
      }
    }
  }

  // Language hard-enforcement: BEGINNER/ELEMENTARY students with specific language preference
  // must be in a group where the teacher can teach in that language
  const LANGUAGE_HARD_LEVELS = new Set(["BEGINNER", "ELEMENTARY"]);
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, level: true, preferredLanguage: true },
  });

  const teacher = await prisma.teacher.findUnique({
    where: { id: group.teacherId },
    select: { teachingLanguage: true },
  });

  if (teacher) {
    for (const s of students) {
      if (!LANGUAGE_HARD_LEVELS.has(s.level)) continue;
      if (s.preferredLanguage === "ANY") continue;
      // Teacher with ANY (both) can teach any language
      if (teacher.teachingLanguage === "ANY") continue;

      if (s.preferredLanguage !== teacher.teachingLanguage) {
        const langLabel = s.preferredLanguage === "UZBEK" ? "Uzbek" : "Russian";
        return {
          error: `Student ${s.firstName} ${s.lastName} requires ${langLabel} instruction at ${s.level} level, but this group's teacher cannot teach in ${langLabel}`,
        };
      }
    }
  }

  // Auto-calculate lessonsStart from joinDate
  const lessonsStart = calculateLessonsStart(group.lessons, joinDate);

  await prisma.$transaction(async (tx) => {
    for (const studentId of studentIds) {
      const membership = await tx.groupMembership.create({
        data: {
          studentId,
          groupId,
          joinDate,
          isTrial,
          lessonsStart,
          comment,
          assignedById: admin.id,
        },
      });

      // For non-trial memberships: create billing periods (C#32)
      if (!isTrial) {
        const levelCategory = getLevelCategory(group.level);
        const pricePerLesson = await getApplicablePrice(
          levelCategory,
          group.type,
          joinDate,
          tx,
        );

        const lessonDates = group.lessons
          .filter((l) => l.lessonDate >= joinDate)
          .map((l) => l.lessonDate);

        const periods = buildPaymentPeriods(
          lessonDates,
          joinDate,
          pricePerLesson,
          studentId,
          groupId,
          membership.id,
        );

        if (periods.length > 0) {
          await tx.studentPaymentPeriod.createMany({ data: periods });
        }
      }

      // Activate student if awaiting assignment (both trial and non-trial)
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { status: true },
      });

      if (student && student.status === "AWAITING_ASSIGNMENT") {
        await tx.student.update({
          where: { id: studentId },
          data: {
            status: "ACTIVE",
            activatedAt: new Date(),
            activatedById: admin.id,
          },
        });
      }
    }
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/reception");
  return { success: true };
}

export async function resolveTrialMembership(membershipId: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = trialResolutionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { id: membershipId },
    include: {
      group: {
        select: {
          id: true,
          level: true,
          type: true,
          lessons: {
            where: { originalLessonId: null },
            select: { lessonDate: true },
            orderBy: { lessonDate: "asc" },
          },
        },
      },
      student: {
        select: { id: true, status: true },
      },
    },
  });

  if (!membership) {
    return { error: "Membership not found" };
  }

  if (!membership.isTrial) {
    return { error: "This membership is not a trial" };
  }

  if (parsed.data.action === "commit") {
    // Commit: set isTrial=false, create billing periods, activate student
    await prisma.$transaction(async (tx) => {
      await tx.groupMembership.update({
        where: { id: membershipId },
        data: { isTrial: false },
      });

      const levelCategory = getLevelCategory(membership.group.level);
      const pricePerLesson = await getApplicablePrice(
        levelCategory,
        membership.group.type,
        membership.joinDate,
        tx,
      );

      const lessonDates = membership.group.lessons.map((l) => l.lessonDate);

      const periods = buildPaymentPeriods(
        lessonDates,
        membership.joinDate,
        pricePerLesson,
        membership.studentId,
        membership.groupId,
        membershipId,
      );

      if (periods.length > 0) {
        await tx.studentPaymentPeriod.createMany({ data: periods });
      }

      // Activate student if awaiting assignment
      if (membership.student.status === "AWAITING_ASSIGNMENT") {
        await tx.student.update({
          where: { id: membership.studentId },
          data: {
            status: "ACTIVE",
            activatedAt: new Date(),
            activatedById: admin.id,
          },
        });
      }
    });
  } else {
    // Remove: set leaveDate=today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.groupMembership.update({
      where: { id: membershipId },
      data: { leaveDate: today },
    });
  }

  revalidatePath(`/groups/${membership.groupId}`);
  revalidatePath("/reception");
  return { success: true };
}
