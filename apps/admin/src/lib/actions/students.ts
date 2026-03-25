"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PrismaClient } from "@eng/database";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { studentSchema, deactivateStudentSchema } from "@/schemas/student";
import { markUncertainSchema } from "@/schemas/uncertain";
import { removeFamilyIfNeeded, detectFamily, applyFamilyToExistingMembers } from "@/lib/helpers/promotion-auto-detect";
import { performLeaveBilling } from "@/lib/helpers/leave-billing";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Fields to clear when resolving the uncertain flag */
const UNCERTAIN_CLEAR_FIELDS = {
  isUncertain: false,
  uncertainFlaggedBy: null,
  uncertainReasonId: null,
  uncertainComment: null,
} as const;

/** Close the most recent open UncertainHistory record for a student */
async function resolveUncertainHistory(tx: TxClient, studentId: string, adminId: string) {
  const openHistory = await tx.uncertainHistory.findFirst({
    where: { studentId, resolvedAt: null },
    orderBy: { flaggedAt: "desc" },
  });
  if (openHistory) {
    await tx.uncertainHistory.update({
      where: { id: openHistory.id },
      data: { resolvedAt: new Date(), resolvedById: adminId },
    });
  }
}

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

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      groupMemberships: {
        where: { leaveDate: null },
        select: { id: true, isTrial: true, group: { select: { id: true, publicId: true } } },
      },
    },
  });

  if (!student) {
    return { error: "Student not found" };
  }

  if (student.status === "INACTIVE") {
    return { error: "Student is already inactive" };
  }

  // C#17: Validate that otherLostReason is provided if the reason isOther
  const reason = await prisma.lostReason.findUnique({
    where: { id: parsed.data.lostReasonId },
  });

  if (!reason) {
    return { error: "Invalid lost reason" };
  }

  if (reason.isOther && !parsed.data.otherLostReason) {
    return { error: "Please specify the reason" };
  }

  const groupIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Close all active memberships + leave billing
    for (const m of student.groupMemberships) {
      groupIds.add(m.group.id);

      await tx.groupMembership.update({
        where: { id: m.id },
        data: { leaveDate: today },
      });

      // Run leave billing for non-trial memberships
      if (!m.isTrial) {
        const result = await performLeaveBilling({
          membershipId: m.id,
          leaveDate: today,
          adjustmentType: "DROPOUT",
          adminId: admin.id,
          tx,
        });

        // Create pending refund if overpayment exists
        if (result.overpayment > 0 && result.adjustedPeriodId) {
          await tx.refund.create({
            data: {
              studentId: id,
              studentPaymentPeriodId: result.adjustedPeriodId,
              amount: result.overpayment,
              status: "PENDING",
              initiatedById: admin.id,
              note: `Deactivation from ${m.group.publicId}`,
            },
          });
        }
      }
    }

    await tx.student.update({
      where: { id },
      data: {
        status: "INACTIVE",
        inactivatedAt: new Date(),
        inactivatedById: admin.id,
        lostReasonId: parsed.data.lostReasonId,
        otherLostReason: parsed.data.otherLostReason,
      },
    });

    // FAMILY auto-removal: if family drops below 2 active members,
    // expire FAMILY promotions and remove discounts from future periods
    await removeFamilyIfNeeded({ familyId: student.familyId, tx });
  });

  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
  revalidatePath("/reception");
  revalidatePath("/reassignment");
  revalidatePath("/lost");
  for (const gId of groupIds) {
    revalidatePath(`/groups/${gId}`);
  }
  return { success: true };
}

/**
 * Send student to reassignment — closes a specific group membership.
 *
 * When called with a membershipId: closes that membership + leave billing,
 * then sets AWAITING_REASSIGNMENT if no other active memberships remain.
 *
 * When called without membershipId (orphan case or INACTIVE→AWAITING_REASSIGNMENT):
 * just changes status.
 */
export async function sendToReassignment(studentId: string, membershipId?: string) {
  const admin = await requireAdmin();

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      groupMemberships: {
        where: { leaveDate: null },
        select: { id: true, isTrial: true, group: { select: { id: true, publicId: true } } },
      },
    },
  });

  if (!student) {
    return { error: "Student not found" };
  }

  if (student.status !== "ACTIVE" && student.status !== "INACTIVE") {
    return { error: "Only active or inactive students can be sent to reassignment" };
  }

  // Validate membership before entering the transaction
  const targetMembership = membershipId
    ? student.groupMemberships.find((m) => m.id === membershipId)
    : null;
  if (membershipId && !targetMembership) {
    return { error: "Membership not found or already closed" };
  }

  let closedGroupId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Close specific membership if provided
    if (membershipId && targetMembership) {
      closedGroupId = targetMembership.group.id;

      await tx.groupMembership.update({
        where: { id: membershipId },
        data: { leaveDate: today },
      });

      // Run leave billing for non-trial memberships
      if (!targetMembership.isTrial) {
        const result = await performLeaveBilling({
          membershipId,
          leaveDate: today,
          adjustmentType: "DROPOUT",
          adminId: admin.id,
          tx,
        });

        if (result.overpayment > 0 && result.adjustedPeriodId) {
          await tx.refund.create({
            data: {
              studentId,
              studentPaymentPeriodId: result.adjustedPeriodId,
              amount: result.overpayment,
              status: "PENDING",
              initiatedById: admin.id,
              note: `Reassignment from ${targetMembership.group.publicId}`,
            },
          });
        }
      }
    }

    // Check remaining active memberships (excluding the one we just closed)
    const remainingActive = student.groupMemberships.filter(
      (m) => m.id !== membershipId,
    ).length;

    // Combine status + uncertain changes into a single update
    if (remainingActive === 0) {
      // Keep inactivation fields intact for INACTIVE → AWAITING_REASSIGNMENT.
      // lostReasonId != null at activation time = WIN_BACK student (came from Lost List).
      // Fields are cleared at the final activation point in addStudentsToGroup.
      await tx.student.update({
        where: { id: studentId },
        data: {
          status: "AWAITING_REASSIGNMENT",
          ...(student.isUncertain ? UNCERTAIN_CLEAR_FIELDS : {}),
        },
      });
    } else if (student.isUncertain) {
      await tx.student.update({
        where: { id: studentId },
        data: UNCERTAIN_CLEAR_FIELDS,
      });
    }

    if (student.isUncertain) {
      await resolveUncertainHistory(tx, studentId, admin.id);
    }
  });

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/reassignment");
  revalidatePath("/lost");
  revalidatePath("/uncertain");
  if (closedGroupId) {
    revalidatePath(`/groups/${closedGroupId}`);
  }
  return { success: true };
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

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      groupMemberships: {
        where: { leaveDate: null },
        select: { id: true, isTrial: true, group: { select: { id: true, publicId: true } } },
      },
    },
  });

  if (!student) {
    return { error: "Student not found" };
  }

  const membership = student.groupMemberships.find((m) => m.id === membershipId);
  if (!membership) {
    return { error: "Membership not found or already closed" };
  }

  const reason = await prisma.lostReason.findUnique({
    where: { id: parsed.data.lostReasonId },
  });

  if (!reason) {
    return { error: "Invalid lost reason" };
  }

  if (reason.isOther && !parsed.data.otherLostReason) {
    return { error: "Please specify the reason" };
  }

  await prisma.$transaction(async (tx) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Close this membership
    await tx.groupMembership.update({
      where: { id: membershipId },
      data: { leaveDate: today },
    });

    // Run leave billing for non-trial memberships
    if (!membership.isTrial) {
      const result = await performLeaveBilling({
        membershipId,
        leaveDate: today,
        adjustmentType: "DROPOUT",
        adminId: admin.id,
        tx,
      });

      if (result.overpayment > 0 && result.adjustedPeriodId) {
        await tx.refund.create({
          data: {
            studentId,
            studentPaymentPeriodId: result.adjustedPeriodId,
            amount: result.overpayment,
            status: "PENDING",
            initiatedById: admin.id,
            note: `Left group ${membership.group.publicId}`,
          },
        });
      }
    }

    // Check remaining active memberships
    const remainingActive = student.groupMemberships.filter(
      (m) => m.id !== membershipId,
    ).length;

    // Combine deactivation + uncertain changes into a single update
    if (remainingActive === 0) {
      await tx.student.update({
        where: { id: studentId },
        data: {
          status: "INACTIVE",
          inactivatedAt: new Date(),
          inactivatedById: admin.id,
          lostReasonId: parsed.data.lostReasonId,
          otherLostReason: parsed.data.otherLostReason,
          ...(student.isUncertain ? UNCERTAIN_CLEAR_FIELDS : {}),
        },
      });

      await removeFamilyIfNeeded({ familyId: student.familyId, tx });
    } else if (student.isUncertain) {
      await tx.student.update({
        where: { id: studentId },
        data: UNCERTAIN_CLEAR_FIELDS,
      });
    }

    if (student.isUncertain) {
      await resolveUncertainHistory(tx, studentId, admin.id);
    }
  });

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/reassignment");
  revalidatePath("/lost");
  revalidatePath("/uncertain");
  revalidatePath(`/groups/${membership.group.id}`);
  return { success: true };
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

