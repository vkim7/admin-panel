"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { addStudentsSchema, trialResolutionSchema, transferTrialSchema } from "@/schemas/group-membership";
import { getLevelCategory, calculateLessonsStart } from "@/lib/helpers/lesson-generation";
import { getApplicablePrice, buildPaymentPeriods } from "@/lib/helpers/billing";
import { checkScheduleConflicts } from "@/lib/helpers/lesson-scheduling";
import { applyPromotionsToPeriods } from "@/lib/helpers/promotions";
import { getScheduledCapacity } from "@/lib/helpers/capacity";
import { getUzbekistanToday } from "@/lib/helpers/date";
import { executeAssign } from "@/lib/helpers/execute-assign";
import { checkAssignConflicts } from "@/lib/helpers/scheduled-action-conflicts";

export async function addStudentsToGroup(groupId: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = addStudentsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { studentIds, joinDate: joinDateStr, comment } = parsed.data;
  const joinDate = new Date(joinDateStr + "T00:00:00Z");
  const today = getUzbekistanToday();

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, type: true, startDate: true },
  });
  if (!group) return { error: "Group not found" };

  if (joinDate.getTime() < group.startDate.getTime()) {
    const startStr = group.startDate.toISOString().slice(0, 10);
    return { error: `Join date can't be before group start date (${startStr})` };
  }

  const isFuture = joinDate.getTime() > today.getTime();

  if (isFuture) {
    // Future join date → create scheduled action(s), one per student
    // Capacity check
    const capacity = await getScheduledCapacity(groupId, joinDate);
    if (studentIds.length > capacity.availableSlots) {
      return {
        error: `Not enough capacity. ${capacity.availableSlots} slot${capacity.availableSlots === 1 ? "" : "s"} available, ${studentIds.length} student${studentIds.length === 1 ? "" : "s"} selected.`,
      };
    }

    // Conflict checks per student
    for (const studentId of studentIds) {
      const conflict = await checkAssignConflicts(studentId, groupId, group.type, joinDate);
      if (conflict) return { error: conflict };
    }

    // Create one scheduled action per student
    for (const studentId of studentIds) {
      await prisma.scheduledAction.create({
        data: {
          type: "ASSIGN",
          effectiveDate: joinDate,
          studentId,
          destGroupId: groupId,
          payload: { comment: comment ?? null },
          createdById: admin.id,
        },
      });
    }

    revalidatePath(`/groups/${groupId}`);
    revalidatePath("/scheduled-actions");
    revalidatePath("/schedule");
    revalidatePath("/reception");
    return { success: true, scheduled: true };
  }

  // Today or past → execute immediately
  const result = await executeAssign({
    groupId,
    studentIds,
    joinDate,
    comment,
    adminId: admin.id,
  });

  if ("error" in result) return result;

  for (const path of result.revalidatePaths) revalidatePath(path);
  if (result.warning) {
    return { success: true, warning: result.warning };
  }
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

export async function transferTrialStudent(membershipId: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = transferTrialSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { destinationGroupId } = parsed.data;

  const membership = await prisma.groupMembership.findUnique({
    where: { id: membershipId },
    include: {
      group: { select: { id: true, type: true } },
      student: { select: { id: true, status: true } },
    },
  });

  if (!membership) return { error: "Membership not found" };
  if (!membership.isTrial) return { error: "This membership is not a trial" };
  if (membership.leaveDate) return { error: "This membership is already closed" };

  const destGroup = await prisma.group.findUnique({
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
    },
  });

  if (!destGroup) return { error: "Destination group not found" };
  if (!destGroup.isActive) return { error: "Destination group is not active" };
  if (destGroup.id === membership.groupId) return { error: "Cannot transfer to the same group" };

  // Capacity check — accounts for pending scheduled actions
  const capacity = await getScheduledCapacity(destinationGroupId, new Date());
  if (capacity.availableSlots <= 0) {
    return { error: "Destination group is full" };
  }

  // Duplicate check
  if (destGroup.memberships.some((m) => m.studentId === membership.studentId)) {
    return { error: "Student is already active in the destination group" };
  }

  // Schedule conflict check
  const conflict = await checkScheduleConflicts(
    membership.studentId,
    destGroup.id,
    destGroup.days,
    destGroup.startTime,
    destGroup.durationMinutes,
    prisma,
  );
  if (conflict) return conflict;

  // Membership type limit: max 1 GROUP + 1 INDIVIDUAL (exclude source group being left)
  const otherActive = await prisma.groupMembership.findMany({
    where: {
      studentId: membership.studentId,
      leaveDate: null,
      groupId: { notIn: [membership.groupId, destinationGroupId] },
    },
    include: { group: { select: { type: true, publicId: true } } },
  });
  const sameType = otherActive.find((m) => m.group.type === destGroup.type);
  if (sameType) {
    const label = destGroup.type === "GROUP" ? "group" : "individual";
    return {
      error: `Student already has an active ${label} lesson (${sameType.group.publicId}). Students can have at most one group and one individual lesson.`,
    };
  }

  // Check trial attempts remaining for destination group type
  const trialLimit = destGroup.type === "GROUP" ? 2 : 1;
  const trialCount = await prisma.groupMembership.count({
    where: {
      studentId: membership.studentId,
      wasTrialOriginally: true,
      group: { type: destGroup.type },
    },
  });

  if (trialCount >= trialLimit) {
    return {
      error: `No trial attempts remaining for ${destGroup.type === "GROUP" ? "group" : "individual"} lessons. Use Send to Lost or Send to Reassignment instead.`,
    };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const lessonsStart = calculateLessonsStart(destGroup.lessons, today);

  await prisma.$transaction(async (tx) => {
    // Close source membership
    await tx.groupMembership.update({
      where: { id: membershipId },
      data: { leaveDate: today },
    });

    // Create new trial membership in destination group
    await tx.groupMembership.create({
      data: {
        studentId: membership.studentId,
        groupId: destinationGroupId,
        joinDate: today,
        isTrial: true,
        wasTrialOriginally: true,
        trialTeacherId: destGroup.teacherId,
        lessonsStart,
        assignedById: admin.id,
        previousMembershipId: membershipId,
      },
    });
  });

  revalidatePath(`/groups/${membership.groupId}`);
  revalidatePath(`/groups/${destinationGroupId}`);
  revalidatePath("/reception");
  revalidatePath("/reassignment");
  revalidatePath(`/students/${membership.studentId}`);
  return { success: true };
}

export async function updateMembershipComment(membershipId: string, comment: string | null) {
  await requireAdmin();

  if (comment !== null && comment.length > 500) {
    return { error: "Comment must be 500 characters or fewer" };
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { id: membershipId },
    select: { groupId: true },
  });

  if (!membership) {
    return { error: "Membership not found" };
  }

  await prisma.groupMembership.update({
    where: { id: membershipId },
    data: { comment: comment?.trim() || null },
  });

  revalidatePath(`/groups/${membership.groupId}`);
  return { success: true };
}
