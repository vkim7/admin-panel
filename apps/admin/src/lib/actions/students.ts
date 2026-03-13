"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { studentSchema, deactivateStudentSchema } from "@/schemas/student";

export async function createStudent(data: unknown) {
  await requireAdmin();
  const parsed = studentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { dateOfBirth, preferredDays, ...rest } = parsed.data;

  try {
    const student = await prisma.student.create({
      data: {
        ...rest,
        dateOfBirth: new Date(dateOfBirth),
        preferredDays,
      },
    });
    redirect(`/students/${student.id}`);
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

export async function updateStudent(id: string, data: unknown) {
  await requireAdmin();
  const parsed = studentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { dateOfBirth, preferredDays, ...rest } = parsed.data;

  try {
    await prisma.student.update({
      where: { id },
      data: {
        ...rest,
        dateOfBirth: new Date(dateOfBirth),
        preferredDays,
      },
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

  await prisma.student.update({
    where: { id },
    data: {
      status: "INACTIVE",
      inactivatedAt: new Date(),
      inactivatedById: admin.id,
      lostReasonId: parsed.data.lostReasonId,
      otherLostReason: parsed.data.otherLostReason,
    },
  });

  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
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
  return { success: true };
}
