"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import {
  teacherSchema,
  availabilityBlockSchema,
  rateChangeSchema,
  updateRateChangeSchema,
} from "@/schemas/teacher";
import { getCurrentPriceLimits } from "@/lib/queries/teachers";

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

export async function setAvailability(teacherId: string, data: unknown) {
  await requireAdmin();

  const parsed = z.array(availabilityBlockSchema).safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  // Check for overlapping ranges within the same day
  const byDay = new Map<number, typeof parsed.data>();
  for (const block of parsed.data) {
    const list = byDay.get(block.dayOfWeek) ?? [];
    list.push(block);
    byDay.set(block.dayOfWeek, list);
  }
  for (const [, dayBlocks] of byDay) {
    for (let i = 0; i < dayBlocks.length; i++) {
      for (let j = i + 1; j < dayBlocks.length; j++) {
        const a = dayBlocks[i]!;
        const b = dayBlocks[j]!;
        if (a.startTime < b.endTime && a.endTime > b.startTime) {
          return {
            error: `Overlapping ranges: ${a.startTime}–${a.endTime} and ${b.startTime}–${b.endTime}`,
          };
        }
      }
    }
  }

  await prisma.$transaction([
    prisma.teacherAvailability.deleteMany({ where: { teacherId } }),
    ...(parsed.data.length > 0
      ? [
          prisma.teacherAvailability.createMany({
            data: parsed.data.map((block) => ({ teacherId, ...block })),
          }),
        ]
      : []),
  ]);

  revalidatePath(`/teachers/${teacherId}`);
  return { success: true };
}

// ─── Rates ────────────────────────────────────────────────────────────────────

async function validateRateLimits(
  groupLessonRate: number,
  individualLessonRate: number,
): Promise<string | null> {
  const limits = await getCurrentPriceLimits();
  if (!limits) return null;
  if (groupLessonRate > limits.maxGroupRate) {
    return `Group rate cannot exceed ${limits.maxGroupRate.toLocaleString("en-US")} UZS (current max student price)`;
  }
  if (individualLessonRate > limits.maxIndividualRate) {
    return `Individual rate cannot exceed ${limits.maxIndividualRate.toLocaleString("en-US")} UZS (current max student price)`;
  }
  return null;
}

export async function addRateChange(teacherId: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = rateChangeSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const limitError = await validateRateLimits(
    parsed.data.groupLessonRate,
    parsed.data.individualLessonRate,
  );
  if (limitError) return { error: limitError };

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

export async function updateRateChange(id: string, data: unknown) {
  const admin = await requireAdmin();
  const parsed = updateRateChangeSchema.safeParse({ id, ...data as object });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const limitError = await validateRateLimits(
    parsed.data.groupLessonRate,
    parsed.data.individualLessonRate,
  );
  if (limitError) return { error: limitError };

  // Get the existing record to know the teacherId for revalidation
  const existing = await prisma.teacherRateChange.findUnique({ where: { id } });
  if (!existing) return { error: "Rate entry not found" };

  try {
    await prisma.teacherRateChange.update({
      where: { id },
      data: {
        groupLessonRate: parsed.data.groupLessonRate,
        individualLessonRate: parsed.data.individualLessonRate,
        effectiveFrom: new Date(parsed.data.effectiveFrom),
        changedById: admin.id,
      },
    });
    revalidatePath(`/teachers/${existing.teacherId}`);
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
