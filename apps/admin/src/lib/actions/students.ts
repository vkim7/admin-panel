"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { studentSchema, deactivateStudentSchema } from "@/schemas/student";
import { removeFamilyIfNeeded, detectFamily, applyFamilyToExistingMembers } from "@/lib/helpers/promotion-auto-detect";

export async function createStudent(data: unknown) {
  await requireAdmin();
  const parsed = studentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { dateOfBirth, preferredDays, preferredTimeSlots, promoCode, ...rest } = parsed.data;

  // Validate promo code before creating student (fail fast)
  let promoCodePromotion: { id: string; validityDays: number | null } | null = null;
  if (promoCode) {
    const promo = await prisma.promotion.findUnique({
      where: { code: promoCode },
      select: { id: true, type: true, isActive: true, validityDays: true },
    });

    if (!promo) {
      return { error: `Promo code "${promoCode}" not found` };
    }
    if (promo.type !== "PROMO_CODE") {
      return { error: `Code "${promoCode}" is not a valid promo code` };
    }
    if (!promo.isActive) {
      return { error: `Promo code "${promoCode}" is no longer active` };
    }
    promoCodePromotion = { id: promo.id, validityDays: promo.validityDays };
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

  redirect(`/students/${studentId}`);
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

    revalidatePath(`/students/${id}`);
    redirect(`/students/${id}`);
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
        select: { id: true, group: { select: { publicId: true } } },
      },
    },
  });

  if (!student) {
    return { error: "Student not found" };
  }

  if (student.status === "INACTIVE") {
    return { error: "Student is already inactive" };
  }

  // Warn about active memberships
  if (student.groupMemberships.length > 0) {
    const groupIds = student.groupMemberships.map((m) => m.group.publicId).join(", ");
    return {
      error: `Student has active group memberships (${groupIds}). Handle those first.`,
    };
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

  await prisma.$transaction(async (tx) => {
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
  return { success: true };
}

export async function sendToReassignment(id: string) {
  await requireAdmin();

  const student = await prisma.student.findUnique({ where: { id } });

  if (!student) {
    return { error: "Student not found" };
  }

  if (student.status !== "ACTIVE" && student.status !== "INACTIVE") {
    return { error: "Only active or inactive students can be sent to reassignment" };
  }

  // Keep inactivation fields intact for INACTIVE → AWAITING_REASSIGNMENT.
  // lostReasonId != null at activation time = WIN_BACK student (came from Lost List).
  // Fields are cleared at the final activation point in addStudentsToGroup.
  await prisma.student.update({
    where: { id },
    data: {
      status: "AWAITING_REASSIGNMENT",
    },
  });

  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
  revalidatePath("/reassignment");
  revalidatePath("/lost");
  return { success: true };
}

export async function toggleUncertain(studentId: string, isUncertain: boolean) {
  await requireAdmin();

  await prisma.student.update({
    where: { id: studentId },
    data: {
      isUncertain,
      uncertainFlaggedBy: isUncertain ? "ADMIN" : null,
      uncertainComment: isUncertain ? undefined : null,
    },
  });

  revalidatePath("/groups");
  return { success: true };
}

export async function reactivateStudent(id: string) {
  await requireAdmin();

  const student = await prisma.student.findUnique({ where: { id } });

  if (!student) {
    return { error: "Student not found" };
  }

  if (student.status !== "INACTIVE") {
    return { error: "Only inactive students can be reactivated" };
  }

  await prisma.student.update({
    where: { id },
    data: {
      status: "AWAITING_ASSIGNMENT",
      inactivatedAt: null,
      inactivatedById: null,
      lostReasonId: null,
      otherLostReason: null,
    },
  });

  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
  revalidatePath("/reception");
  revalidatePath("/lost");
  return { success: true };
}
