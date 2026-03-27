"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { createScheduledActionSchema, cancelScheduledActionSchema } from "@/schemas/scheduled-action";
import { getUzbekistanToday } from "@/lib/helpers/date";
import { checkScheduledActionConflict } from "@/lib/helpers/scheduled-action-conflicts";
import { executeSingleScheduledAction } from "@/lib/helpers/execute-scheduled-action";

/**
 * Create a scheduled action for future execution.
 * Validates effectiveDate > today (Tashkent), checks for conflicts.
 */
export async function createScheduledAction(data: unknown) {
  const admin = await requireAdmin();
  const parsed = createScheduledActionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { type, effectiveDate: dateStr, studentId, membershipId, sourceGroupId, destinationGroupId, payload } = parsed.data;

  const effectiveDate = new Date(dateStr + "T00:00:00Z");
  const today = getUzbekistanToday();

  if (effectiveDate.getTime() <= today.getTime()) {
    return { error: "Effective date must be in the future" };
  }

  // Conflict check
  const conflict = await checkScheduledActionConflict(type, membershipId, sourceGroupId);
  if (conflict) return { error: conflict };

  await prisma.scheduledAction.create({
    data: {
      type,
      effectiveDate,
      studentId: studentId ?? null,
      membershipId: membershipId ?? null,
      sourceGroupId: sourceGroupId ?? null,
      destGroupId: destinationGroupId ?? null,
      payload: payload ?? {},
      createdById: admin.id,
    },
  });

  revalidatePath("/scheduled-actions");
  return { success: true, scheduled: true };
}

/**
 * Cancel a pending scheduled action.
 */
export async function cancelScheduledAction(data: unknown) {
  await requireAdmin();
  const parsed = cancelScheduledActionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const action = await prisma.scheduledAction.findUnique({
    where: { id: parsed.data.id },
  });

  if (!action) {
    return { error: "Scheduled action not found" };
  }

  if (action.status !== "PENDING") {
    return { error: `Cannot cancel a ${action.status.toLowerCase()} action` };
  }

  await prisma.scheduledAction.update({
    where: { id: action.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: parsed.data.cancelReason,
    },
  });

  revalidatePath("/scheduled-actions");
  return { success: true };
}

/**
 * Execute a pending scheduled action immediately ("Execute Now").
 */
export async function executeScheduledActionNow(id: string) {
  const admin = await requireAdmin();

  const action = await prisma.scheduledAction.findUnique({
    where: { id },
  });

  if (!action) {
    return { error: "Scheduled action not found" };
  }

  if (action.status !== "PENDING") {
    return { error: `Cannot execute a ${action.status.toLowerCase()} action` };
  }

  const result = await executeSingleScheduledAction(action, admin.id);

  if ("error" in result) {
    return { error: result.error };
  }

  for (const path of result.revalidatePaths) revalidatePath(path);
  revalidatePath("/scheduled-actions");
  return { success: true };
}
