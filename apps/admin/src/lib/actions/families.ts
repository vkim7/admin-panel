"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { familySchema } from "@/schemas/family";

export async function createFamily(data: unknown) {
  await requireAdmin();
  const parsed = familySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    const family = await prisma.family.create({
      data: parsed.data,
    });

    revalidatePath("/students");
    return { success: true, familyId: family.id };
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A family with this phone number already exists" };
    }
    throw e;
  }
}

export async function updateFamily(id: string, data: unknown) {
  await requireAdmin();
  const parsed = familySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    await prisma.family.update({
      where: { id },
      data: parsed.data,
    });

    revalidatePath("/students");
    return { success: true };
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A family with this phone number already exists" };
    }
    throw e;
  }
}

export async function searchFamiliesAction(query: string) {
  await requireAdmin();

  if (!query || query.trim().length < 2) return [];

  const q = query.trim();

  return prisma.family.findMany({
    where: {
      OR: [
        { parentPhone: { contains: q } },
        { parentFirstName: { contains: q, mode: "insensitive" } },
        { parentLastName: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      parentFirstName: true,
      parentLastName: true,
      parentPhone: true,
      name: true,
      students: { select: { id: true, firstName: true, lastName: true } },
    },
    take: 10,
  });
}
