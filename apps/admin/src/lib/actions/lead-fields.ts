"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import {
  leadPreferencesSchema,
  setNextCallbackSchema,
  markCallbackDoneSchema,
  markTestSentSchema,
  recordTestScoreSchema,
} from "@/schemas/lead";
import {
  autoTransitionToContacted,
  recordLeadActivity,
} from "@/lib/helpers/lead-activity";

export async function saveLeadPreferences(data: unknown) {
  const admin = await requireAdmin();
  const parsed = leadPreferencesSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const dob = parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null;

  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: parsed.data.id },
      select: {
        preferredDays: true,
        preferredTimeSlots: true,
        preferredDaysAny: true,
        preferredTimeSlotsAny: true,
        lessonPreference: true,
        preferredLanguage: true,
        selfAssessedLevel: true,
        dateOfBirth: true,
        adminNote: true,
      },
    });
    if (!lead) return;

    const sameDays =
      lead.preferredDays.length === parsed.data.preferredDays.length &&
      lead.preferredDays.every((d) => parsed.data.preferredDays.includes(d));
    const sameSlots =
      lead.preferredTimeSlots.length ===
        parsed.data.preferredTimeSlots.length &&
      lead.preferredTimeSlots.every((s) =>
        (parsed.data.preferredTimeSlots as readonly string[]).includes(s),
      );
    const sameDaysAny = lead.preferredDaysAny === parsed.data.preferredDaysAny;
    const sameSlotsAny =
      lead.preferredTimeSlotsAny === parsed.data.preferredTimeSlotsAny;
    const sameLessonPref = lead.lessonPreference === parsed.data.lessonPreference;
    const sameLanguage = lead.preferredLanguage === parsed.data.preferredLanguage;
    const sameLevel = lead.selfAssessedLevel === parsed.data.selfAssessedLevel;
    const sameDob =
      (lead.dateOfBirth?.toISOString().slice(0, 10) ?? null) ===
      (parsed.data.dateOfBirth ?? null);
    const sameNote = (lead.adminNote ?? "") === (parsed.data.adminNote ?? "");

    const prefsChanged = !(
      sameDays &&
      sameSlots &&
      sameDaysAny &&
      sameSlotsAny &&
      sameLessonPref &&
      sameLanguage &&
      sameLevel &&
      sameDob
    );
    const noteChanged = !sameNote;

    if (!prefsChanged && !noteChanged) return;

    await autoTransitionToContacted(tx, parsed.data.id, admin.id);

    await tx.lead.update({
      where: { id: parsed.data.id },
      data: {
        ...(prefsChanged && {
          preferredDays: parsed.data.preferredDays,
          preferredTimeSlots: parsed.data.preferredTimeSlots,
          preferredDaysAny: parsed.data.preferredDaysAny,
          preferredTimeSlotsAny: parsed.data.preferredTimeSlotsAny,
          lessonPreference: parsed.data.lessonPreference,
          preferredLanguage: parsed.data.preferredLanguage,
          selfAssessedLevel: parsed.data.selfAssessedLevel,
          dateOfBirth: dob,
        }),
        ...(noteChanged && { adminNote: parsed.data.adminNote }),
      },
    });
    if (prefsChanged) {
      await recordLeadActivity(tx, parsed.data.id, admin.id, {
        type: "SCHEDULE_SET",
        days: parsed.data.preferredDays,
        timeSlots: parsed.data.preferredTimeSlots,
      });
    }
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function setNextCallback(data: unknown) {
  const admin = await requireAdmin();
  const parsed = setNextCallbackSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const at = new Date(parsed.data.at);

  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: parsed.data.id },
      select: { id: true },
    });
    if (!lead) return;

    await autoTransitionToContacted(tx, parsed.data.id, admin.id);

    await tx.lead.update({
      where: { id: parsed.data.id },
      data: { nextCallbackAt: at },
    });
    await recordLeadActivity(tx, parsed.data.id, admin.id, {
      type: "CALLBACK_SET",
      at: at.toISOString(),
    });
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function markCallbackDone(data: unknown) {
  const admin = await requireAdmin();
  const parsed = markCallbackDoneSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: parsed.data.id },
      select: { nextCallbackAt: true },
    });
    if (!lead || lead.nextCallbackAt === null) return;

    const scheduledFor = lead.nextCallbackAt;

    await tx.lead.update({
      where: { id: parsed.data.id },
      data: { nextCallbackAt: null },
    });
    await recordLeadActivity(tx, parsed.data.id, admin.id, {
      type: "CALLBACK_DONE",
      scheduledFor: scheduledFor.toISOString(),
    });
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function markTestSent(data: unknown) {
  const admin = await requireAdmin();
  const parsed = markTestSentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: parsed.data.id },
      select: { id: true },
    });
    if (!lead) return;

    await autoTransitionToContacted(tx, parsed.data.id, admin.id);

    // Sending a (new) test resets the score — admin will record a new one when
    // it comes back. Keeps the audit honest about which test was scored.
    await tx.lead.update({
      where: { id: parsed.data.id },
      data: {
        testSentAt: new Date(),
        testLevelSent: parsed.data.level,
        testScore: null,
        testScoredAt: null,
      },
    });
    await recordLeadActivity(tx, parsed.data.id, admin.id, {
      type: "TEST_SENT",
      level: parsed.data.level,
    });
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function recordTestScore(data: unknown) {
  const admin = await requireAdmin();
  const parsed = recordTestScoreSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: parsed.data.id },
      select: { testSentAt: true, testLevelSent: true },
    });
    if (!lead) return { success: true as const };

    if (lead.testSentAt === null || lead.testLevelSent === null) {
      return { error: "Cannot record a score before a test was sent" };
    }

    await autoTransitionToContacted(tx, parsed.data.id, admin.id);

    await tx.lead.update({
      where: { id: parsed.data.id },
      data: {
        testScore: parsed.data.score,
        testScoredAt: new Date(),
      },
    });
    await recordLeadActivity(tx, parsed.data.id, admin.id, {
      type: "TEST_SCORED",
      score: parsed.data.score,
      level: lead.testLevelSent,
    });

    return { success: true as const };
  });

  if ("error" in result) return result;
  revalidatePath("/leads");
  return result;
}
