"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import {
  updateLeadStatusSchema,
  updateLeadNoteSchema,
} from "@/schemas/lead";

export async function updateLeadStatus(data: unknown) {
  await requireAdmin();
  const parsed = updateLeadStatusSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  await prisma.lead.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function updateLeadNote(data: unknown) {
  await requireAdmin();
  const parsed = updateLeadNoteSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  await prisma.lead.update({
    where: { id: parsed.data.id },
    data: { adminNote: parsed.data.adminNote },
  });

  revalidatePath("/leads");
  return { success: true };
}
