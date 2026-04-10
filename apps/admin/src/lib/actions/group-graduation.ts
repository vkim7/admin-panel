"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { graduateGroupSchema } from "@/schemas/group-graduation";
import { getNextLevel, canGraduate } from "@/lib/helpers/level-progression";
import {
  calculateEndDate,
  generateLessonDates,
  getLevelCategory,
} from "@/lib/helpers/lesson-generation";
import { calculateExamDates } from "@/lib/helpers/exam-calculation";
import { findNextValidDate } from "@/lib/helpers/lesson-scheduling";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";
import { applyPromotionsToPeriods } from "@/lib/helpers/promotions";
import { getGraduationPreview } from "@/lib/queries/group-graduation";
import { createZoomMeeting, deleteZoomMeeting } from "@/lib/zoom";

/**
 * Graduate a group: create successor group at next level, move continuing students,
 * handle reassignments and deactivations.
 */
export async function graduateGroup(data: unknown) {
  const admin = await requireAdmin();
  const parsed = graduateGroupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { groupId, studentDecisions } = parsed.data;

  // Load group with full details
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        where: { leaveDate: null },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      lessons: {
        where: { originalLessonId: null },
        select: { lessonDate: true, status: true },
        orderBy: { lessonDate: "asc" },
      },
    },
  });

  if (!group) return { error: "Group not found" };

  // Validate graduation eligibility
  const eligibility = canGraduate({
    level: group.level,
    isActive: group.isActive,
    skipAutoGraduation: group.skipAutoGraduation,
    lessons: group.lessons,
  });

  if (!eligibility.eligible) {
    return { error: eligibility.reason };
  }

  const nextLevel = getNextLevel(group.level);
  if (!nextLevel) return { error: "No next level available" };

  // Validate every active student has a decision
  const activeMemberships = group.memberships;
  const decisionMap = new Map(studentDecisions.map((d) => [d.studentId, d]));

  for (const m of activeMemberships) {
    if (!decisionMap.has(m.student.id)) {
      return { error: `Missing decision for student ${m.student.firstName} ${m.student.lastName}` };
    }
  }

  // Validate DEACTIVATE students have lostReasonId
  for (const d of studentDecisions) {
    if (d.decision === "DEACTIVATE") {
      if (!d.lostReasonId) {
        return { error: "Deactivated students must have a lost reason" };
      }
      // Validate reason exists
      const reason = await prisma.lostReason.findUnique({ where: { id: d.lostReasonId } });
      if (!reason || !reason.isActive) {
        return { error: "Invalid lost reason" };
      }
    }
  }

  // Compute new group parameters
  const holidays = await prisma.holiday.findMany({ select: { date: true } });
  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0]!),
  );

  const lastLesson = group.lessons[group.lessons.length - 1];
  if (!lastLesson) return { error: "Group has no lessons" };

  const startDate = findNextValidDate(lastLesson.lessonDate, group.days, holidayDates);
  if (!startDate) return { error: "Could not find a valid start date for the new group" };

  const endDate = calculateEndDate(startDate);
  const lessonDates = generateLessonDates(startDate, endDate, group.days, holidayDates);

  if (lessonDates.length === 0) {
    return { error: "No lessons could be generated for the new group" };
  }

  // Teacher double-booking check
  const existingSlots = await prisma.teacherScheduleSlot.findMany({
    where: {
      teacherId: group.teacherId,
      startTime: group.startTime,
      date: { in: lessonDates },
    },
    include: {
      group: { select: { publicId: true } },
    },
  });

  if (existingSlots.length > 0) {
    const conflicts = existingSlots
      .slice(0, 3)
      .map((s) => `${s.date.toISOString().split("T")[0]} (${s.group.publicId})`)
      .join(", ");
    return {
      error: `Teacher is already scheduled at ${group.startTime} on: ${conflicts}${existingSlots.length > 3 ? ` and ${existingSlots.length - 3} more` : ""}`,
    };
  }

  const continuingStudents = studentDecisions.filter((d) => d.decision === "CONTINUE");

  // Transaction
  const result = await prisma.$transaction(async (tx) => {
    // (a) Create new group — same cascade as createGroup
    const levelCategory = getLevelCategory(nextLevel);
    const pricePerLesson = await getApplicablePrice(levelCategory, group.type, startDate, tx);

    const newGroup = await tx.group.create({
      data: {
        type: group.type,
        teacherId: group.teacherId,
        days: group.days,
        startTime: group.startTime,
        durationMinutes: group.durationMinutes,
        level: nextLevel,
        maxStudents: group.maxStudents,
        startDate,
        endDate,
        // Zoom meeting created after transaction (best-effort)
      },
    });

    // Create lessons
    const lessonData = lessonDates.map((date, index) => ({
      groupId: newGroup.id,
      teacherId: group.teacherId,
      originalTeacherId: group.teacherId,
      lessonNumber: index + 1,
      lessonDate: date,
      startTime: group.startTime,
    }));

    const lessons = await tx.lesson.createManyAndReturn({ data: lessonData });

    // Create schedule slots
    await tx.teacherScheduleSlot.createMany({
      data: lessons.map((lesson) => ({
        teacherId: group.teacherId,
        date: lesson.lessonDate,
        startTime: group.startTime,
        groupId: newGroup.id,
        lessonId: lesson.id,
      })),
    });

    // Create teacher history
    await tx.groupTeacherHistory.create({
      data: {
        groupId: newGroup.id,
        teacherId: group.teacherId,
        startDate,
      },
    });

    // Create Exam records (mid + final)
    const examDates = calculateExamDates(lessons);
    if (examDates) {
      await tx.exam.createMany({
        data: [
          { groupId: newGroup.id, type: "MID", scheduledDate: examDates.mid },
          { groupId: newGroup.id, type: "FINAL", scheduledDate: examDates.final },
        ],
      });
    }

    // (b) Per-student decisions
    for (const m of activeMemberships) {
      const decision = decisionMap.get(m.student.id)!;

      if (decision.decision === "CONTINUE") {
        // Create membership in new group
        const newMembership = await tx.groupMembership.create({
          data: {
            studentId: m.student.id,
            groupId: newGroup.id,
            joinDate: startDate,
            isTrial: false,
            lessonsStart: 1,
            previousMembershipId: m.id,
            assignedById: admin.id,
          },
        });

        // Build billing periods
        const periods = buildPaymentPeriods(
          lessonDates,
          startDate,
          pricePerLesson,
          m.student.id,
          newGroup.id,
          newMembership.id,
        );

        if (periods.length > 0) {
          await tx.studentPaymentPeriod.createMany({ data: periods });

          // Apply promotions to newly created billing periods
          await applyPromotionsToPeriods({
            studentId: m.student.id,
            membershipId: newMembership.id,
            groupLevel: nextLevel,
            groupType: group.type,
            tx,
          });
        }

        // Update student level (C#33)
        await tx.student.update({
          where: { id: m.student.id },
          data: { level: nextLevel },
        });
      } else if (decision.decision === "REASSIGN") {
        await tx.student.update({
          where: { id: m.student.id },
          data: { status: "AWAITING_REASSIGNMENT" },
        });
      } else if (decision.decision === "DEACTIVATE") {
        await tx.student.update({
          where: { id: m.student.id },
          data: {
            status: "INACTIVE",
            lostReasonId: decision.lostReasonId,
            otherLostReason: decision.otherLostReason ?? null,
            inactivatedAt: new Date(),
            inactivatedById: admin.id,
          },
        });
      }
    }

    // (c) Close old group — set leaveDate on all memberships (record-keeping only, NO performLeaveBilling)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const m of activeMemberships) {
      await tx.groupMembership.update({
        where: { id: m.id },
        data: { leaveDate: today },
      });
    }

    await tx.group.update({
      where: { id: groupId },
      data: {
        graduatedIntoGroupId: newGroup.id,
        isActive: false,
        zoomMeetingId: null,
        zoomJoinUrl: null,
      },
    });

    return { newGroupId: newGroup.id };
  });

  // Best-effort: delete old Zoom meeting and create new one for successor group
  if (group.zoomMeetingId) {
    await deleteZoomMeeting(group.zoomMeetingId);
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: group.teacherId },
    select: { zoomEmail: true, firstName: true, lastName: true },
  });

  if (teacher?.zoomEmail) {
    const newGroup = await prisma.group.findUnique({
      where: { id: result.newGroupId },
      select: { publicId: true },
    });
    const zoomResult = await createZoomMeeting({
      zoomEmail: teacher.zoomEmail,
      topic: `${newGroup?.publicId ?? result.newGroupId} - ${teacher.firstName} ${teacher.lastName}`,
      startTime: group.startTime,
      durationMinutes: group.durationMinutes,
      days: group.days,
      startDate,
      endDate,
    });
    if (zoomResult) {
      await prisma.group.update({
        where: { id: result.newGroupId },
        data: {
          zoomMeetingId: zoomResult.meetingId,
          zoomJoinUrl: zoomResult.joinUrl,
        },
      });
    }
  }

  // Revalidate
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${result.newGroupId}`);
  revalidatePath("/groups");
  revalidatePath("/schedule");
  revalidatePath("/students");
  revalidatePath("/payments");
  revalidatePath("/reception");
  revalidatePath("/reassignment");
  revalidatePath("/lost");
  revalidatePath("/exams");

  return {
    success: true,
    newGroupId: result.newGroupId,
    continuingCount: continuingStudents.length,
  };
}

/**
 * Auth-gated wrapper for graduation preview.
 */
export async function getGraduationPreviewAction(groupId: string) {
  await requireAdmin();
  return getGraduationPreview(groupId);
}
