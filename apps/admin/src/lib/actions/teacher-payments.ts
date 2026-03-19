"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import {
  generateTeacherPaySchema,
  markTeacherPaidSchema,
  markGroupPayPaidSchema,
} from "@/schemas/teacher-payment";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function generateTeacherPay(data: unknown) {
  const admin = await requireAdmin();
  const parsed = generateTeacherPaySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { year, month } = parsed.data;

  // Validate month has ended
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)); // last day of the target month
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (lastDayOfMonth >= today) {
    return { error: `Cannot generate pay for ${MONTH_NAMES[month]} ${year} — the month hasn't ended yet` };
  }

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = lastDayOfMonth;

  // 1. Fetch all COMPLETED lessons in the month range
  const lessons = await prisma.lesson.findMany({
    where: {
      status: "COMPLETED",
      lessonDate: { gte: periodStart, lte: periodEnd },
    },
    select: {
      teacherId: true,
      groupId: true,
      activeStudentCount: true,
    },
  });

  if (lessons.length === 0) {
    return { error: `No completed lessons found for ${MONTH_NAMES[month]} ${year}` };
  }

  // 2. Group in-memory by (teacherId, groupId)
  const grouped = new Map<string, { teacherId: string; groupId: string; lessonsCompleted: number; totalStudentLessons: number }>();

  for (const lesson of lessons) {
    const key = `${lesson.teacherId}:${lesson.groupId}`;
    const existing = grouped.get(key);
    const studentCount = lesson.activeStudentCount ?? 0;
    if (existing) {
      existing.lessonsCompleted++;
      existing.totalStudentLessons += studentCount;
    } else {
      grouped.set(key, {
        teacherId: lesson.teacherId,
        groupId: lesson.groupId,
        lessonsCompleted: 1,
        totalStudentLessons: studentCount,
      });
    }
  }

  // 3. Batch fetch rates: most recent TeacherRateChange where effectiveFrom <= periodStart
  const teacherIds = [...new Set([...grouped.values()].map((g) => g.teacherId))];
  const rateChanges = await prisma.teacherRateChange.findMany({
    where: {
      teacherId: { in: teacherIds },
      effectiveFrom: { lte: periodStart },
    },
    orderBy: { effectiveFrom: "desc" },
  });

  // Pick most recent rate per teacher
  const rateByTeacher = new Map<string, typeof rateChanges[number]>();
  for (const rc of rateChanges) {
    if (!rateByTeacher.has(rc.teacherId)) {
      rateByTeacher.set(rc.teacherId, rc);
    }
  }

  // 4. Batch fetch groups for type lookup
  const groupIds = [...new Set([...grouped.values()].map((g) => g.groupId))];
  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    select: { id: true, type: true },
  });
  const groupTypeMap = new Map(groups.map((g) => [g.id, g.type]));

  // 5. Build records
  const warnings: string[] = [];
  const records: {
    teacherId: string;
    groupId: string;
    periodYear: number;
    periodMonth: number;
    lessonsCompleted: number;
    totalStudentLessons: number;
    rate: number;
    amount: number;
    generatedById: string;
  }[] = [];

  for (const entry of grouped.values()) {
    const rateChange = rateByTeacher.get(entry.teacherId);
    if (!rateChange) {
      warnings.push(`Teacher ${entry.teacherId} has no rate for this period — skipped`);
      continue;
    }

    const groupType = groupTypeMap.get(entry.groupId);
    const rate = groupType === "INDIVIDUAL"
      ? rateChange.individualLessonRate
      : rateChange.groupLessonRate;

    const amount = entry.totalStudentLessons * rate;

    if (amount === 0) continue; // Skip zero-amount records

    records.push({
      teacherId: entry.teacherId,
      groupId: entry.groupId,
      periodYear: year,
      periodMonth: month,
      lessonsCompleted: entry.lessonsCompleted,
      totalStudentLessons: entry.totalStudentLessons,
      rate,
      amount,
      generatedById: admin.id,
    });
  }

  if (records.length === 0 && warnings.length === 0) {
    return { error: "No payable records to generate (all amounts are zero)" };
  }

  // 6. Create records with skipDuplicates
  const result = await prisma.teacherPaymentPeriod.createMany({
    data: records,
    skipDuplicates: true,
  });

  revalidatePath("/teacher-payments");
  revalidatePath("/teachers");

  return {
    success: true,
    created: result.count,
    skipped: records.length - result.count,
    warnings,
  };
}

/**
 * Mark all UNPAID records for a teacher in a given month as PAID.
 */
export async function markTeacherPaid(data: unknown) {
  await requireAdmin();
  const parsed = markTeacherPaidSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { teacherId, year, month } = parsed.data;

  const result = await prisma.teacherPaymentPeriod.updateMany({
    where: {
      teacherId,
      periodYear: year,
      periodMonth: month,
      status: "UNPAID",
    },
    data: { status: "PAID", paidAt: new Date() },
  });

  if (result.count === 0) {
    return { error: "No unpaid records found" };
  }

  revalidatePath("/teacher-payments");
  revalidatePath("/teachers");
  return { success: true, count: result.count };
}

/**
 * Mark a single TeacherPaymentPeriod record as PAID.
 */
export async function markGroupPayPaid(data: unknown) {
  await requireAdmin();
  const parsed = markGroupPayPaidSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const record = await prisma.teacherPaymentPeriod.findUnique({
    where: { id: parsed.data.id },
  });

  if (!record) {
    return { error: "Payment record not found" };
  }

  if (record.status === "PAID") {
    return { error: "Already marked as paid" };
  }

  await prisma.teacherPaymentPeriod.update({
    where: { id: parsed.data.id },
    data: { status: "PAID", paidAt: new Date() },
  });

  revalidatePath("/teacher-payments");
  revalidatePath("/teachers");
  return { success: true };
}
