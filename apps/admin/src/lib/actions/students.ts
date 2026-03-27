"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { studentSchema, deactivateStudentSchema } from "@/schemas/student";
import { markUncertainSchema } from "@/schemas/uncertain";
import { removeFamilyIfNeeded, detectFamily, applyFamilyToExistingMembers } from "@/lib/helpers/promotion-auto-detect";
import { UNCERTAIN_CLEAR_FIELDS, resolveUncertainHistory } from "@/lib/helpers/uncertain";
import { executeDeactivate } from "@/lib/helpers/execute-deactivate";
import { executeReassignment } from "@/lib/helpers/execute-reassignment";
import { executeSendToLost } from "@/lib/helpers/execute-send-to-lost";
import { getUzbekistanToday } from "@/lib/helpers/date";
import { checkImmediateStudentActionConflict, checkImmediateDeactivateConflict, checkScheduledActionConflict } from "@/lib/helpers/scheduled-action-conflicts";

export async function createStudent(data: unknown, redirectTo?: string) {
  await requireAdmin();
  const parsed = studentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { dateOfBirth, preferredDays, preferredTimeSlots, promoCode, referredByCode, ...rest } = parsed.data;

  // Validate promo code before creating student (fail fast)
  let promoCodePromotion: { id: string; validityDays: number | null } | null = null;
  if (promoCode) {
    const promo = await prisma.promotion.findUnique({
      where: { code: promoCode },
      select: { id: true, type: true, isActive: true, validityDays: true },
    });

    if (!promo) {
      // Check if it's a student referral code entered in the wrong field
      const studentWithCode = await prisma.student.findFirst({
        where: { referralCode: promoCode },
        select: { id: true },
      });
      if (studentWithCode) {
        return { error: `"${promoCode}" is a referral code — enter it in the Referral Code field instead` };
      }
      return { error: `Promo code "${promoCode}" not found` };
    }
    if (promo.type !== "PROMO_CODE") {
      return { error: `Code "${promoCode}" is not a promo code (it's a ${promo.type.toLowerCase().replace("_", " ")} promotion)` };
    }
    if (!promo.isActive) {
      return { error: `Promo code "${promoCode}" is no longer active` };
    }
    promoCodePromotion = { id: promo.id, validityDays: promo.validityDays };
  }

  // Validate referral code — find the referring student
  let referrerStudentId: string | null = null;
  if (referredByCode) {
    const referrer = await prisma.student.findFirst({
      where: { referralCode: referredByCode },
      select: { id: true },
    });
    if (!referrer) {
      // Check if it's a promo code entered in the wrong field
      const promoWithCode = await prisma.promotion.findUnique({
        where: { code: referredByCode },
        select: { id: true },
      });
      if (promoWithCode) {
        return { error: `"${referredByCode}" is a promo code — enter it in the Promo Code field instead` };
      }
      return { error: `Referral code "${referredByCode}" not found` };
    }
    referrerStudentId = referrer.id;
  }

  // Auto-generate a unique referral code (8 chars, alphanumeric uppercase)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  const referralCode = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  let studentId: string;

  try {
    studentId = await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          ...rest,
          dateOfBirth: new Date(dateOfBirth),
          preferredDays,
          preferredTimeSlots,
          referralCode,
        },
      });

      // PROMO_CODE: attach StudentPromotion
      if (promoCodePromotion) {
        const expiresAt = promoCodePromotion.validityDays
          ? new Date(Date.now() + promoCodePromotion.validityDays * 24 * 60 * 60 * 1000)
          : null;

        await tx.studentPromotion.create({
          data: { studentId: student.id, promotionId: promoCodePromotion.id, expiresAt },
        });
      }

      // REFERRAL: create referral record linking referrer → this student
      if (referrerStudentId) {
        await tx.referral.create({
          data: {
            referrerStudentId,
            referredStudentId: student.id,
          },
        });
      }

      // SEASONAL: attach StudentPromotion if an active campaign window is open
      const now = new Date();
      const seasonalPromos = await tx.promotion.findMany({
        where: {
          type: "SEASONAL",
          isActive: true,
          validFrom: { lte: now },
          validTo: { gte: now },
        },
        select: { id: true, validityDays: true },
      });

      for (const promo of seasonalPromos) {
        const expiresAt = promo.validityDays
          ? new Date(Date.now() + promo.validityDays * 24 * 60 * 60 * 1000)
          : null;

        await tx.studentPromotion.create({
          data: { studentId: student.id, promotionId: promo.id, expiresAt },
        });
      }

      return student.id;
    });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A student with this phone number already exists" };
    }
    throw e;
  }

  const safeRedirect = redirectTo === "/reception" ? "/reception" : `/students/${studentId}`;
  redirect(safeRedirect);
}

export async function updateStudent(id: string, data: unknown) {
  await requireAdmin();
  const parsed = studentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { dateOfBirth, preferredDays, preferredTimeSlots, promoCode: _promoCode, ...rest } = parsed.data;

  // Check if familyId is changing (for FAMILY promotion auto-detection/removal)
  const oldStudent = await prisma.student.findUnique({
    where: { id },
    select: { familyId: true, status: true },
  });

  const familyChanged = oldStudent && oldStudent.familyId !== rest.familyId;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          ...rest,
          dateOfBirth: new Date(dateOfBirth),
          preferredDays,
          preferredTimeSlots,
        },
      });

      // FAMILY promotion handling on family change (active students only)
      if (familyChanged && oldStudent.status === "ACTIVE") {
        // Old family may drop below 2 active members
        await removeFamilyIfNeeded({ familyId: oldStudent.familyId, tx });

        // New family may now reach 2+ active members
        if (rest.familyId) {
          const newlyPromoted = await detectFamily({ studentId: id, familyId: rest.familyId, tx });
          await applyFamilyToExistingMembers({ memberIds: newlyPromoted, tx });
        }
      }
    });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A student with this phone number already exists" };
    }
    throw e;
  }

  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}`);
}

export async function deactivateStudent(id: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = deactivateStudentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const effectiveDate = new Date(parsed.data.effectiveDate + "T00:00:00Z");
  const today = getUzbekistanToday();

  if (effectiveDate.getTime() < today.getTime()) {
    return { error: "Effective date cannot be in the past" };
  }

  if (effectiveDate.getTime() === today.getTime()) {
    const deactivateConflict = await checkImmediateDeactivateConflict(id);
    if (deactivateConflict) return { error: deactivateConflict };

    const result = await executeDeactivate({
      studentId: id,
      lostReasonId: parsed.data.lostReasonId,
      otherLostReason: parsed.data.otherLostReason,
      adminId: admin.id,
      effectiveDate,
    });
    if ("error" in result) return { error: result.error };

    for (const path of result.revalidatePaths) revalidatePath(path);
    return { success: true };
  }

  // Future date — create scheduled action
  // For deactivate, check if student has any pending scheduled action
  const conflict = await checkScheduledActionConflict("DEACTIVATE", undefined, undefined, id);
  if (conflict) return { error: conflict };

  await prisma.scheduledAction.create({
    data: {
      type: "DEACTIVATE",
      effectiveDate,
      studentId: id,
      payload: {
        lostReasonId: parsed.data.lostReasonId,
        otherLostReason: parsed.data.otherLostReason,
      },
      createdById: admin.id,
    },
  });

  revalidatePath("/scheduled-actions");
  return { success: true, scheduled: true };
}

/**
 * Send student to reassignment — closes a specific group membership.
 *
 * When called with a membershipId: closes that membership + leave billing,
 * then sets AWAITING_REASSIGNMENT if no other active memberships remain.
 *
 * When called without membershipId (orphan case or INACTIVE→AWAITING_REASSIGNMENT):
 * just changes status (effectiveDateStr not required).
 */
export async function sendToReassignment(studentId: string, membershipId?: string, effectiveDateStr?: string) {
  const admin = await requireAdmin();

  const today = getUzbekistanToday();
  const effectiveDate = effectiveDateStr
    ? new Date(effectiveDateStr + "T00:00:00Z")
    : today;

  if (effectiveDate.getTime() < today.getTime()) {
    return { error: "Effective date cannot be in the past" };
  }

  if (effectiveDate.getTime() === today.getTime()) {
    if (membershipId) {
      const conflict = await checkImmediateStudentActionConflict(membershipId);
      if (conflict) return { error: conflict };
    }

    const result = await executeReassignment({
      studentId,
      membershipId,
      adminId: admin.id,
      effectiveDate,
    });
    if ("error" in result) return { error: result.error };

    for (const path of result.revalidatePaths) revalidatePath(path);
    return { success: true };
  }

  // Future date — create scheduled action
  if (!membershipId) {
    return { error: "Cannot schedule reassignment without a membership" };
  }

  const conflict = await checkScheduledActionConflict("SEND_TO_REASSIGNMENT", membershipId);
  if (conflict) return { error: conflict };

  await prisma.scheduledAction.create({
    data: {
      type: "SEND_TO_REASSIGNMENT",
      effectiveDate,
      studentId,
      membershipId,
      payload: {},
      createdById: admin.id,
    },
  });

  revalidatePath("/scheduled-actions");
  return { success: true, scheduled: true };
}

/**
 * Send student to lost list from a specific group — closes that membership
 * and deactivates the student if no other active memberships remain.
 */
export async function sendToLostList(
  studentId: string,
  membershipId: string,
  data: unknown,
) {
  const admin = await requireAdmin();
  const parsed = deactivateStudentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const effectiveDate = new Date(parsed.data.effectiveDate + "T00:00:00Z");
  const today = getUzbekistanToday();

  if (effectiveDate.getTime() < today.getTime()) {
    return { error: "Effective date cannot be in the past" };
  }

  if (effectiveDate.getTime() === today.getTime()) {
    const conflict = await checkImmediateStudentActionConflict(membershipId);
    if (conflict) return { error: conflict };

    const result = await executeSendToLost({
      studentId,
      membershipId,
      lostReasonId: parsed.data.lostReasonId,
      otherLostReason: parsed.data.otherLostReason,
      adminId: admin.id,
      effectiveDate,
    });
    if ("error" in result) return { error: result.error };

    for (const path of result.revalidatePaths) revalidatePath(path);
    return { success: true };
  }

  // Future date — create scheduled action
  const conflict = await checkScheduledActionConflict("SEND_TO_LOST", membershipId);
  if (conflict) return { error: conflict };

  await prisma.scheduledAction.create({
    data: {
      type: "SEND_TO_LOST",
      effectiveDate,
      studentId,
      membershipId,
      payload: {
        lostReasonId: parsed.data.lostReasonId,
        otherLostReason: parsed.data.otherLostReason,
      },
      createdById: admin.id,
    },
  });

  revalidatePath("/scheduled-actions");
  return { success: true, scheduled: true };
}

export async function markUncertain(studentId: string, data: unknown) {
  const admin = await requireAdmin();

  const parsed = markUncertainSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { uncertainReasonId, otherReason } = parsed.data;

  const reason = await prisma.uncertainReason.findUnique({
    where: { id: uncertainReasonId },
  });
  if (!reason || !reason.isActive) {
    return { error: "Invalid uncertain reason" };
  }
  if (reason.isOther && !otherReason) {
    return { error: "Please specify a reason" };
  }

  await prisma.$transaction([
    prisma.student.update({
      where: { id: studentId },
      data: {
        isUncertain: true,
        uncertainFlaggedBy: "ADMIN",
        uncertainReasonId,
        uncertainComment: reason.isOther ? otherReason : null,
      },
    }),
    prisma.uncertainHistory.create({
      data: {
        studentId,
        uncertainReasonId,
        otherReason: reason.isOther ? otherReason : null,
        flaggedBy: "ADMIN",
        flaggedById: admin.id,
      },
    }),
  ]);

  revalidatePath("/groups");
  revalidatePath("/uncertain");
  return { success: true };
}

export async function resolveUncertain(studentId: string) {
  const admin = await requireAdmin();

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: studentId },
      data: UNCERTAIN_CLEAR_FIELDS,
    });
    await resolveUncertainHistory(tx, studentId, admin.id);
  });

  revalidatePath("/groups");
  revalidatePath("/uncertain");
  return { success: true };
}

export async function updateStudentComment(studentId: string, comment: string | null) {
  await requireAdmin();

  if (comment !== null && comment.length > 500) {
    return { error: "Comment must be 500 characters or fewer" };
  }

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) return { error: "Student not found" };

  await prisma.student.update({
    where: { id: studentId },
    data: { comment: comment?.trim() || null },
  });

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/reception");
  revalidatePath("/reassignment");
  return { success: true };
}
