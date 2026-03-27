"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { mergeGroupSchema } from "@/schemas/group-merge";
import { executeMerge } from "@/lib/helpers/execute-merge";
import { getUzbekistanToday } from "@/lib/helpers/date";
import { checkImmediateMergeConflict, checkScheduledActionConflict } from "@/lib/helpers/scheduled-action-conflicts";
import { previewMergeBilling } from "@/lib/queries/group-merge";

/**
 * Merge source group into destination group.
 * Today = immediate execution. Future date = creates scheduled action.
 */
export async function mergeGroup(data: unknown) {
  const admin = await requireAdmin();
  const parsed = mergeGroupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const effectiveDate = new Date(parsed.data.effectiveDate + "T00:00:00Z");
  const today = getUzbekistanToday();

  if (effectiveDate.getTime() < today.getTime()) {
    return { error: "Effective date cannot be in the past" };
  }

  if (effectiveDate.getTime() === today.getTime()) {
    // Immediate execution
    const conflict = await checkImmediateMergeConflict(parsed.data.sourceGroupId);
    if (conflict) return { error: conflict };

    const result = await executeMerge({
      sourceGroupId: parsed.data.sourceGroupId,
      destinationGroupId: parsed.data.destinationGroupId,
      adminId: admin.id,
      effectiveDate,
    });
    if ("error" in result) return { error: result.error };

    for (const path of result.revalidatePaths) revalidatePath(path);
    return {
      success: true,
      movedCount: result.movedCount,
      ...(result.warning && { warning: result.warning }),
    };
  }

  // Future date — create scheduled action
  const conflict = await checkScheduledActionConflict("MERGE_GROUP", undefined, parsed.data.sourceGroupId);
  if (conflict) return { error: conflict };

  await prisma.scheduledAction.create({
    data: {
      type: "MERGE_GROUP",
      effectiveDate,
      sourceGroupId: parsed.data.sourceGroupId,
      destGroupId: parsed.data.destinationGroupId,
      payload: {},
      createdById: admin.id,
    },
  });

  revalidatePath("/scheduled-actions");
  return { success: true, scheduled: true };
}

/**
 * Auth-gated wrapper for merge billing preview.
 */
export async function getMergeBillingPreview(sourceGroupId: string, destGroupId: string) {
  await requireAdmin();
  return previewMergeBilling(sourceGroupId, destGroupId);
}
