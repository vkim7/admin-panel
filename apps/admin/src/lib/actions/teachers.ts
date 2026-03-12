"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import {
  teacherSchema,
  availabilityBlockSchema,
  rateChangeSchema,
} from "@/schemas/teacher";

export async function createTeacher(data: unknown) {
  await requireAdmin();
  const parsed = teacherSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { phone, ...rest } = parsed.data;

  try {
    const teacher = await prisma.teacher.create({
      data: { ...rest, phone },
    });

    // Create initial rate entry (C#14)
    await prisma.teacherRateChange.create({
      data: {
        teacherId: teacher.id,
        groupLessonRate: 0,
        individualLessonRate: 0,
        effectiveFrom: new Date(),
        changedById: null,
      },
    });

    redirect(`/teachers/${teacher.id}`);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A teacher with this phone number already exists" };
    }
    throw e;
  }
}

export async function updateTeacher(id: string, data: unknown) {
  await requireAdmin();
  const parsed = teacherSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    await prisma.teacher.update({
      where: { id },
      data: parsed.data,
    });
    revalidatePath(`/teachers/${id}`);
    redirect(`/teachers/${id}`);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A teacher with this phone number already exists" };
    }
    throw e;
  }
}

export async function deactivateTeacher(id: string) {
  const admin = await requireAdmin();

  // C#11: Check for active groups
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      groups: {
        where: { isActive: true },
        select: { id: true, publicId: true },
      },
    },
  });

  if (!teacher) {
    return { error: "Teacher not found" };
  }

  if (teacher.groups.length > 0) {
    const groupIds = teacher.groups.map((g) => g.publicId).join(", ");
    return {
      error: `Cannot deactivate: teacher has active groups (${groupIds}). Reassign them first.`,
    };
  }

  await prisma.teacher.update({
    where: { id },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedById: admin.id,
    },
  });

  revalidatePath("/teachers");
  redirect("/teachers");
}

// ─── Availability ─────────────────────────────────────────────────────────────

export async function addAvailabilityBlock(teacherId: string, data: unknown) {
  await requireAdmin();
  const parsed = availabilityBlockSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  // C#34: Check for overlapping blocks on same day
  const existing = await prisma.teacherAvailability.findMany({
    where: { teacherId, dayOfWeek: parsed.data.dayOfWeek },
  });

  const newStart = parsed.data.startTime;
  const newEnd = parsed.data.endTime;

  for (const block of existing) {
    if (newStart < block.endTime && newEnd > block.startTime) {
      return {
        error: `Overlaps with existing block ${block.startTime}–${block.endTime}`,
      };
    }
  }

  await prisma.teacherAvailability.create({
    data: { teacherId, ...parsed.data },
  });

  revalidatePath(`/teachers/${teacherId}`);
  return { success: true };
}

export async function removeAvailabilityBlock(
  teacherId: string,
  blockId: string,
) {
  await requireAdmin();
  await prisma.teacherAvailability.delete({ where: { id: blockId } });
  revalidatePath(`/teachers/${teacherId}`);
  return { success: true };
}

// ─── Rates ────────────────────────────────────────────────────────────────────

export async function addRateChange(teacherId: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = rateChangeSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    await prisma.teacherRateChange.create({
      data: {
        teacherId,
        groupLessonRate: parsed.data.groupLessonRate,
        individualLessonRate: parsed.data.individualLessonRate,
        effectiveFrom: new Date(parsed.data.effectiveFrom),
        changedById: admin.id,
      },
    });
    revalidatePath(`/teachers/${teacherId}`);
    return { success: true };
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A rate entry already exists for this date" };
    }
    throw e;
  }
}
