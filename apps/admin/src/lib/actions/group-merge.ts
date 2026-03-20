"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { mergeGroupSchema } from "@/schemas/group-merge";
import { getLevelCategory, calculateLessonsStart } from "@/lib/helpers/lesson-generation";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";
import { checkScheduleConflicts } from "@/lib/helpers/lesson-scheduling";
import { performLeaveBilling } from "@/lib/helpers/leave-billing";
import { applyTransferCredit } from "@/lib/helpers/transfer-credit";
import { applyPromotionsToPeriods } from "@/lib/helpers/promotions";
import { previewMergeBilling } from "@/lib/queries/group-merge";

/**
 * Merge source group into destination group.
 * All active students in source are moved to destination with billing adjustments.
 * Source group becomes inactive.
 */
export async function mergeGroup(data: unknown) {
  const admin = await requireAdmin();
  const parsed = mergeGroupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { sourceGroupId, destinationGroupId } = parsed.data;

  // Load source group
  const source = await prisma.group.findUnique({
    where: { id: sourceGroupId },
    include: {
      memberships: {
        where: { leaveDate: null },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              level: true,
              preferredLanguage: true,
            },
          },
        },
      },
      lessons: {
        where: { originalLessonId: null },
        select: { lessonNumber: true, lessonDate: true, status: true },
        orderBy: { lessonDate: "asc" },
      },
    },
  });

  if (!source) return { error: "Source group not found" };
  if (!source.isActive) return { error: "Source group is not active" };

  // Load destination group
  const dest = await prisma.group.findUnique({
    where: { id: destinationGroupId },
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
      teacher: { select: { teachingLanguage: true } },
    },
  });

  if (!dest) return { error: "Destination group not found" };
  if (!dest.isActive) return { error: "Destination group is not active" };

  // Same level check
  if (source.level !== dest.level) {
    return { error: "Source and destination groups must be at the same level" };
  }

  // Check for unresolved trials in source
  const unresolvedTrials = source.memberships.filter((m) => m.isTrial);
  if (unresolvedTrials.length > 0) {
    return { error: "Source group has unresolved trial memberships. Resolve them before merging." };
  }

  const activeMemberships = source.memberships.filter((m) => !m.isTrial);

  // Capacity check — destination must have room for ALL source students
  const destActiveCount = dest.memberships.length;
  if (destActiveCount + activeMemberships.length > dest.maxStudents) {
    return {
      error: `Destination group cannot accommodate all ${activeMemberships.length} students (${destActiveCount}/${dest.maxStudents} currently)`,
    };
  }

  // Per-student checks
  const LANGUAGE_HARD_LEVELS = new Set(["BEGINNER", "ELEMENTARY"]);

  for (const m of activeMemberships) {
    // Schedule conflict (exclude source group since students are leaving it)
    const conflict = await checkScheduleConflicts(
      m.student.id,
      destinationGroupId,
      dest.days,
      dest.startTime,
      dest.durationMinutes,
      prisma,
      sourceGroupId,
    );
    if (conflict) return conflict;

    // Language enforcement for BEGINNER/ELEMENTARY
    if (LANGUAGE_HARD_LEVELS.has(m.student.level)) {
      const lang = m.student.preferredLanguage;
      if (lang !== "ANY" && dest.teacher) {
        if (dest.teacher.teachingLanguage !== "ANY" && lang !== dest.teacher.teachingLanguage) {
          const langLabel = lang === "UZBEK" ? "Uzbek" : "Russian";
          return {
            error: `Student ${m.student.firstName} ${m.student.lastName} requires ${langLabel} instruction at ${m.student.level} level, but destination teacher cannot teach in ${langLabel}`,
          };
        }
      }
    }

    // Duplicate check
    if (dest.memberships.some((dm) => dm.studentId === m.student.id)) {
      return { error: `Student ${m.student.firstName} ${m.student.lastName} is already in the destination group` };
    }
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Single atomic transaction
  await prisma.$transaction(async (tx) => {
    for (const m of activeMemberships) {
      // Count completed lessons
      const completedLessons = source.lessons.filter(
        (l) => l.lessonDate <= today && l.status !== "CANCELLED",
      ).length;

      // (a) Close source membership
      await tx.groupMembership.update({
        where: { id: m.id },
        data: {
          leaveDate: today,
          lessonsCompleted: completedLessons,
        },
      });

      // (b) Leave billing on source
      const leaveBilling = await performLeaveBilling({
        membershipId: m.id,
        leaveDate: today,
        adjustmentType: "MERGE",
        adminId: admin.id,
        tx,
      });

      // (c) Create destination membership
      const lessonsStart = calculateLessonsStart(dest.lessons, today);

      const newMembership = await tx.groupMembership.create({
        data: {
          studentId: m.student.id,
          groupId: destinationGroupId,
          joinDate: today,
          isTrial: false,
          lessonsStart,
          previousMembershipId: m.id,
          assignedById: admin.id,
        },
      });

      // (d) Build destination billing periods
      const levelCategory = getLevelCategory(dest.level);
      const pricePerLesson = await getApplicablePrice(
        levelCategory,
        dest.type,
        today,
        tx,
      );

      const destLessonDates = dest.lessons
        .filter((l) => l.lessonDate >= today)
        .map((l) => l.lessonDate);

      const periods = buildPaymentPeriods(
        destLessonDates,
        today,
        pricePerLesson,
        m.student.id,
        destinationGroupId,
        newMembership.id,
      );

      if (periods.length > 0) {
        await tx.studentPaymentPeriod.createMany({ data: periods });

        // Apply promotions to newly created billing periods
        await applyPromotionsToPeriods({
          studentId: m.student.id,
          membershipId: newMembership.id,
          groupLevel: dest.level,
          groupType: dest.type,
          tx,
        });
      }

      // (e) Apply transfer credit
      if (leaveBilling.overpayment > 0) {
        let fallbackPeriodId: string | null = null;
        if (periods.length === 0) {
          const sourcePeriod = await tx.studentPaymentPeriod.findFirst({
            where: { groupMembershipId: m.id },
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
          });
          fallbackPeriodId = sourcePeriod?.id ?? null;
        }

        await applyTransferCredit({
          studentId: m.student.id,
          membershipId: periods.length > 0 ? newMembership.id : null,
          credit: leaveBilling.overpayment,
          sourceGroupId,
          adminId: admin.id,
          tx,
          fallbackPeriodId,
        });
      }
    }

    // Close source group
    await tx.group.update({
      where: { id: sourceGroupId },
      data: {
        mergedIntoGroupId: destinationGroupId,
        isActive: false,
      },
    });
  });

  // Revalidate
  revalidatePath(`/groups/${sourceGroupId}`);
  revalidatePath(`/groups/${destinationGroupId}`);
  revalidatePath("/groups");
  revalidatePath("/schedule");
  revalidatePath("/payments");
  for (const m of activeMemberships) {
    revalidatePath(`/students/${m.student.id}`);
  }

  return { success: true, movedCount: activeMemberships.length };
}

/**
 * Auth-gated wrapper for merge billing preview.
 */
export async function getMergeBillingPreview(sourceGroupId: string, destGroupId: string) {
  await requireAdmin();
  return previewMergeBilling(sourceGroupId, destGroupId);
}
