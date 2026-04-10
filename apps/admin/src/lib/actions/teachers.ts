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
import { findOverlappingBlocks } from "@/lib/availability-patterns";

function teacherUniqueError(e: unknown): string {
  const meta = (e as { meta?: { target?: string[] } }).meta;
  const target = meta?.target;
  if (Array.isArray(target)) {
    if (target.includes("pinfl")) return "A teacher with this PINFL already exists";
    if (target.includes("phone")) return "A teacher with this phone number already exists";
  }
  return "A teacher with this phone number or PINFL already exists";
}

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
      return { error: teacherUniqueError(e) };
    }
    throw e;
  }
}

export async function createTeacherFull(data: {
  teacher: unknown;
  rate: unknown;
  availabilityBlocks: unknown;
}) {
  const admin = await requireAdmin();

  // Validate teacher basic info
  const teacherParsed = teacherSchema.safeParse(data.teacher);
  if (!teacherParsed.success) {
    return { error: teacherParsed.error.issues[0]?.message ?? "Validation failed" };
  }

  // Validate rate if provided
  let rateParsed: z.infer<typeof rateChangeSchema> | null = null;
  if (data.rate) {
    const result = rateChangeSchema.safeParse(data.rate);
    if (!result.success) {
      return { error: result.error.issues[0]?.message ?? "Rate validation failed" };
    }
    const limitError = await validateRateLimits(
      result.data.groupLessonRate,
      result.data.individualLessonRate,
    );
    if (limitError) return { error: limitError };
    rateParsed = result.data;
  }

  // Validate availability blocks if provided
  let availabilityParsed: z.infer<typeof availabilityBlockSchema>[] | null = null;
  if (data.availabilityBlocks && Array.isArray(data.availabilityBlocks) && data.availabilityBlocks.length > 0) {
    const result = z.array(availabilityBlockSchema).safeParse(data.availabilityBlocks);
    if (!result.success) {
      return { error: result.error.issues[0]?.message ?? "Availability validation failed" };
    }
    const overlapError = findOverlappingBlocks(result.data);
    if (overlapError) return { error: overlapError };
    availabilityParsed = result.data;
  }

  try {
    const teacher = await prisma.$transaction(async (tx) => {
      const t = await tx.teacher.create({
        data: teacherParsed.data,
      });

      if (rateParsed) {
        await tx.teacherRateChange.create({
          data: {
            teacherId: t.id,
            groupLessonRate: rateParsed.groupLessonRate,
            individualLessonRate: rateParsed.individualLessonRate,
            effectiveFrom: new Date(rateParsed.effectiveFrom),
            changedById: admin.id,
          },
        });
      }

      if (availabilityParsed && availabilityParsed.length > 0) {
        await tx.teacherAvailability.createMany({
          data: availabilityParsed.map((block) => ({ teacherId: t.id, ...block })),
        });
      }

      return t;
    });

    redirect(`/teachers/${teacher.id}`);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: teacherUniqueError(e) };
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
      return { error: teacherUniqueError(e) };
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

  const overlapError = findOverlappingBlocks(parsed.data);
  if (overlapError) return { error: overlapError };

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
