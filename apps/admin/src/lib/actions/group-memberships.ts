"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { addStudentsSchema, trialResolutionSchema } from "@/schemas/group-membership";
import { getLevelCategory, calculateLessonsStart } from "@/lib/helpers/lesson-generation";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";
import { checkScheduleConflicts } from "@/lib/helpers/lesson-scheduling";
import { applyPromotionsToPeriods } from "@/lib/helpers/promotions";
import {
  detectWinBack,
  detectSeasonal,
  detectFamily,
  applyFamilyToExistingMembers,
} from "@/lib/helpers/promotion-auto-detect";

export async function addStudentsToGroup(groupId: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = addStudentsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { studentIds, joinDate: joinDateStr, comment } = parsed.data;
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
  for (const studentId of studentIds) {
    const conflict = await checkScheduleConflicts(
      studentId,
      groupId,
      group.days,
      group.startTime,
      group.durationMinutes,
      prisma,
    );
    if (conflict) return conflict;
  }

  // Language hard-enforcement: BEGINNER/ELEMENTARY students with specific language preference
  // must be in a group where the teacher can teach in that language
  const LANGUAGE_HARD_LEVELS = new Set(["BEGINNER", "ELEMENTARY"]);
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, level: true, preferredLanguage: true, familyId: true },
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

  // Pre-compute trial attempts per student to auto-determine isTrial
  const trialLimit = group.type === "GROUP" ? 2 : 1;
  const trialCounts = await Promise.all(
    studentIds.map(async (studentId) => {
      const count = await prisma.groupMembership.count({
        where: { studentId, wasTrialOriginally: true, group: { type: group.type } },
      });
      return { studentId, hasTrialRemaining: count < trialLimit };
    }),
  );
  const trialMap = new Map(trialCounts.map((t) => [t.studentId, t.hasTrialRemaining]));

  await prisma.$transaction(async (tx) => {
    for (const studentId of studentIds) {
      const isTrial = trialMap.get(studentId) ?? false;

      const membership = await tx.groupMembership.create({
        data: {
          studentId,
          groupId,
          joinDate,
          isTrial,
          wasTrialOriginally: isTrial,
          trialTeacherId: isTrial ? group.teacherId : null,
          lessonsStart,
          comment,
          assignedById: admin.id,
        },
      });

      // For non-trial memberships: create billing periods (C#32)
      let hasPeriods = false;
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
          hasPeriods = true;
        }
      }

      // Fetch student state for auto-detection + activation
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { status: true, lostReasonId: true, familyId: true },
      });

      const studentInfo = students.find((s) => s.id === studentId);

      // --- Auto-detect promotions (before applyPromotionsToPeriods) ---

      // WIN_BACK: student has lostReasonId (came from Lost List, directly or via reassignment)
      if (student) {
        await detectWinBack({ studentId, lostReasonId: student.lostReasonId, tx });
      }

      // SEASONAL: 0 non-trial committed memberships + active campaign
      await detectSeasonal({ studentId, tx });

      // FAMILY: 2+ active family members (including the student about to be activated)
      const newlyPromotedFamilyMembers = await detectFamily({
        studentId,
        familyId: studentInfo?.familyId ?? student?.familyId ?? null,
        tx,
      });

      // --- Activate student ---
      if (student && (student.status === "AWAITING_ASSIGNMENT" || student.status === "AWAITING_REASSIGNMENT" || student.status === "INACTIVE")) {
        const needsClearInactivation =
          student.status === "INACTIVE" ||
          (student.status === "AWAITING_REASSIGNMENT" && student.lostReasonId != null);

        await tx.student.update({
          where: { id: studentId },
          data: {
            status: "ACTIVE",
            activatedAt: new Date(),
            activatedById: admin.id,
            ...(needsClearInactivation && {
              inactivatedAt: null,
              inactivatedById: null,
              lostReasonId: null,
              otherLostReason: null,
            }),
          },
        });
      }

      // --- Apply all promotions (including auto-detected) to billing periods ---
      if (hasPeriods) {
        await applyPromotionsToPeriods({
          studentId,
          membershipId: membership.id,
          groupLevel: group.level,
          groupType: group.type,
          tx,
        });
      }

      // Apply FAMILY discount to existing family members' future periods
      await applyFamilyToExistingMembers({ memberIds: newlyPromotedFamilyMembers, tx });
    }
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/reception");
  revalidatePath("/reassignment");
  revalidatePath("/lost");
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

        // Auto-assign trial discount matching group type
        const trialPromo = await tx.promotion.findFirst({
          where: {
            type: "TRIAL",
            isActive: true,
            groupTypes: { has: membership.group.type },
          },
          orderBy: { createdAt: "asc" },
          select: { id: true, validityDays: true },
        });

        if (trialPromo) {
          const expiresAt = trialPromo.validityDays
            ? new Date(Date.now() + trialPromo.validityDays * 24 * 60 * 60 * 1000)
            : null;

          await tx.studentPromotion.create({
            data: {
              studentId: membership.studentId,
              promotionId: trialPromo.id,
              expiresAt,
            },
          });
        }

        // Apply promotions (including the trial discount) to billing periods
        await applyPromotionsToPeriods({
          studentId: membership.studentId,
          membershipId,
          groupLevel: membership.group.level,
          groupType: membership.group.type,
          tx,
        });
      }

      // Activate student if awaiting assignment
      if (membership.student.status === "AWAITING_ASSIGNMENT" || membership.student.status === "AWAITING_REASSIGNMENT") {
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
    // Didn't continue: set leaveDate, handle billing for INDIVIDUAL, deactivate
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.$transaction(async (tx) => {
      await tx.groupMembership.update({
        where: { id: membershipId },
        data: { leaveDate: today },
      });

      // INDIVIDUAL trials: bill for attended lessons at 50% discount
      if (membership.group.type === "INDIVIDUAL") {
        // Fetch attended lesson dates (not just count) to derive billing period months
        const attendedRecords = await tx.attendance.findMany({
          where: {
            studentId: membership.studentId,
            groupId: membership.groupId,
            isAbsent: false,
          },
          select: { lesson: { select: { lessonDate: true } } },
        });

        if (attendedRecords.length > 0) {
          const levelCategory = getLevelCategory(membership.group.level);
          const pricePerLesson = await getApplicablePrice(
            levelCategory,
            membership.group.type,
            membership.joinDate,
            tx,
          );

          // Group attended lessons by calendar month (consistent with buildPaymentPeriods)
          const byMonth = new Map<string, number>();
          for (const a of attendedRecords) {
            const d = a.lesson.lessonDate;
            const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
            byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
          }

          for (const [key, lessonCount] of byMonth) {
            const [yearStr, monthStr] = key.split("-");
            const periodYear = parseInt(yearStr!, 10);
            const periodMonth = parseInt(monthStr!, 10);

            await tx.studentPaymentPeriod.create({
              data: {
                studentId: membership.studentId,
                groupId: membership.groupId,
                groupMembershipId: membershipId,
                periodYear,
                periodMonth,
                totalLessons: lessonCount,
                pricePerLesson,
                amountDue: lessonCount * pricePerLesson,
                discountAmount: 0,
                isPartialPeriod: true,
              },
            });
          }

          // Auto-assign TRIAL INDIVIDUAL promotion
          const trialPromo = await tx.promotion.findFirst({
            where: {
              type: "TRIAL",
              isActive: true,
              groupTypes: { has: "INDIVIDUAL" },
            },
            orderBy: { createdAt: "asc" },
            select: { id: true, validityDays: true },
          });

          if (trialPromo) {
            const expiresAt = trialPromo.validityDays
              ? new Date(Date.now() + trialPromo.validityDays * 24 * 60 * 60 * 1000)
              : null;

            await tx.studentPromotion.create({
              data: {
                studentId: membership.studentId,
                promotionId: trialPromo.id,
                expiresAt,
              },
            });

            // Apply promotions to the billing periods
            await applyPromotionsToPeriods({
              studentId: membership.studentId,
              membershipId,
              groupLevel: membership.group.level,
              groupType: membership.group.type,
              tx,
            });
          }
        }
      }
      // GROUP trials: no billing (trial was free)

      // Deactivate student with appropriate lost reason
      const reasonName =
        membership.group.type === "GROUP"
          ? "Trial — didn't continue (Group)"
          : "Trial — didn't continue (Individual)";

      const lostReason = await tx.lostReason.findFirst({
        where: { name: reasonName },
      });

      if (lostReason) {
        // Only deactivate if student has no other active memberships
        const otherActive = await tx.groupMembership.count({
          where: {
            studentId: membership.studentId,
            leaveDate: null,
            id: { not: membershipId },
          },
        });

        if (otherActive === 0) {
          await tx.student.update({
            where: { id: membership.studentId },
            data: {
              status: "INACTIVE",
              inactivatedAt: new Date(),
              inactivatedById: admin.id,
              lostReasonId: lostReason.id,
            },
          });
        }
      }
    });
  }

  revalidatePath(`/groups/${membership.groupId}`);
  revalidatePath("/reception");
  revalidatePath("/reassignment");
  revalidatePath("/lost");
  revalidatePath(`/students/${membership.studentId}`);
  return { success: true };
}
