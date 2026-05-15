"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import {
  updateLeadStatusSchema,
  updateLeadNoteSchema,
  markLeadLostSchema,
} from "@/schemas/lead";
import {
  autoTransitionToContacted,
  recordLeadActivity,
} from "@/lib/helpers/lead-activity";

export async function updateLeadStatus(data: unknown) {
  const admin = await requireAdmin();
  const parsed = updateLeadStatusSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: parsed.data.id },
      select: { status: true },
    });
    if (!lead) return;

    if (lead.status === parsed.data.status) return;

    await tx.lead.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });
    await recordLeadActivity(tx, parsed.data.id, admin.id, {
      type: "STATUS_CHANGE",
      from: lead.status,
      to: parsed.data.status,
    });
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function updateLeadNote(data: unknown) {
  const admin = await requireAdmin();
  const parsed = updateLeadNoteSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: parsed.data.id },
      select: { adminNote: true },
    });
    if (!lead) return;

    const prev = lead.adminNote ?? "";
    const next = parsed.data.adminNote ?? "";
    if (prev === next) return;

    await autoTransitionToContacted(tx, parsed.data.id, admin.id);

    await tx.lead.update({
      where: { id: parsed.data.id },
      data: { adminNote: parsed.data.adminNote },
    });
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function markLeadLost(data: unknown) {
  const admin = await requireAdmin();
  const parsed = markLeadLostSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: parsed.data.id },
      select: { status: true, lostReason: true, lostReasonOther: true },
    });
    if (!lead) return { success: true as const };

    // Converted leads cannot be moved to LOST — that would silently break a
    // student record's origin trail. Return as a known business error.
    if (lead.status === "CONVERTED") {
      return { error: "Converted leads cannot be marked as lost" };
    }

    const otherText =
      parsed.data.reason === "OTHER" ? (parsed.data.otherText ?? null) : null;

    // No-op when status + reason + otherText all match — prevents duplicate
    // LOST activity entries on repeat clicks. A reason change on an already-
    // LOST lead does still emit a fresh LOST entry (meaningful update).
    const sameLost =
      lead.status === "LOST" &&
      lead.lostReason === parsed.data.reason &&
      lead.lostReasonOther === otherText;
    if (sameLost) return { success: true as const };

    await tx.lead.update({
      where: { id: parsed.data.id },
      data: {
        status: "LOST",
        lostReason: parsed.data.reason,
        lostReasonOther: otherText,
      },
    });

    if (lead.status !== "LOST") {
      await recordLeadActivity(tx, parsed.data.id, admin.id, {
        type: "STATUS_CHANGE",
        from: lead.status,
        to: "LOST",
      });
    }
    await recordLeadActivity(tx, parsed.data.id, admin.id, {
      type: "LOST",
      reason: parsed.data.reason,
      ...(otherText ? { otherText } : {}),
    });

    return { success: true as const };
  });

  if ("error" in result) return result;
  revalidatePath("/leads");
  return result;
}

