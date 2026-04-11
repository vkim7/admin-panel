"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import {
  createExcusedAbsenceSchema,
  deleteExcusedAbsenceSchema,
} from "@/schemas/excused-absence";
import {
  adjustBillingForExcusedAbsence,
  reverseBillingForExcusedAbsence,
} from "@/lib/helpers/excused-absence-billing";
import {
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
  deleteR2Object,
} from "@/lib/r2";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// --- File upload ---

export async function getExcusedAbsenceUploadUrl(
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  await requireAdmin();

  if (!ALLOWED_TYPES.includes(contentType)) {
    return { error: "File type not allowed. Use PDF, JPEG, PNG, or WebP." };
  }

  if (fileSize > MAX_FILE_SIZE) {
    return { error: "File too large. Maximum size is 10 MB." };
  }

  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const key = `excused-absences/${Date.now()}-${sanitizedName}`;
  const url = await getUploadPresignedUrl(key, contentType);
  return { url, key };
}

export async function getExcusedAbsenceDocumentUrl(id: string) {
  await requireAdmin();

  const record = await prisma.excusedAbsence.findUnique({
    where: { id },
    select: { documentFileKey: true },
  });

  if (!record?.documentFileKey) return { error: "No document found" };

  const url = await getDownloadPresignedUrl(record.documentFileKey);
  return { url };
}

// --- Create excused absence ---

export async function createExcusedAbsence(
  data: unknown,
  document?: { fileName: string; fileKey: string; fileSize: number },
) {
  const admin = await requireAdmin();
  const parsed = createExcusedAbsenceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const {
    studentId,
    lessonId,
    groupMembershipId,
    reasonId,
    otherReason,
    note,
  } = parsed.data;

  // Validate: lesson must be COMPLETED
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, status: true, lessonDate: true, groupId: true },
  });
  if (!lesson) return { error: "Lesson not found" };
  if (lesson.status !== "COMPLETED") {
    return {
      error: "Excused absence can only be recorded for completed lessons",
    };
  }

  // Validate: membership belongs to student and matches lesson's group
  const membership = await prisma.groupMembership.findUnique({
    where: { id: groupMembershipId },
    select: { id: true, studentId: true, groupId: true },
  });
  if (!membership || membership.studentId !== studentId) {
    return { error: "Invalid membership" };
  }
  if (membership.groupId !== lesson.groupId) {
    return { error: "Lesson does not belong to this group membership" };
  }

  // Validate: no duplicate
  const existing = await prisma.excusedAbsence.findUnique({
    where: { lessonId_studentId: { lessonId, studentId } },
  });
  if (existing) {
    return {
      error: "An excused absence already exists for this lesson and student",
    };
  }

  // Validate: reason exists and check isOther
  const reason = await prisma.excusedAbsenceReason.findUnique({
    where: { id: reasonId },
    select: { isOther: true },
  });
  if (!reason) return { error: "Reason not found" };
  if (reason.isOther && !otherReason?.trim()) {
    return { error: "Please specify the reason" };
  }

  // Transaction: create record + adjust billing
  const result = await prisma.$transaction(async (tx) => {
    const excusedAbsence = await tx.excusedAbsence.create({
      data: {
        lessonId,
        studentId,
        groupMembershipId,
        reasonId,
        otherReason,
        note,
        documentFileName: document?.fileName ?? null,
        documentFileKey: document?.fileKey ?? null,
        documentFileSize: document?.fileSize ?? null,
        createdById: admin.id,
      },
    });

    const billingResult = await adjustBillingForExcusedAbsence({
      groupMembershipId,
      lessonDate: lesson.lessonDate,
      adminId: admin.id,
      tx,
    });

    return { excusedAbsence, billingResult };
  });

  revalidatePath(`/students/${studentId}`);
  return { success: true, ...result.billingResult };
}

// --- Delete excused absence (reversal) ---

export async function deleteExcusedAbsence(data: unknown) {
  const admin = await requireAdmin();
  const parsed = deleteExcusedAbsenceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const record = await prisma.excusedAbsence.findUnique({
    where: { id: parsed.data.id },
    include: {
      lesson: { select: { lessonDate: true } },
    },
  });
  if (!record) return { error: "Excused absence not found" };

  await prisma.$transaction(async (tx) => {
    await reverseBillingForExcusedAbsence({
      groupMembershipId: record.groupMembershipId,
      lessonDate: record.lesson.lessonDate,
      adminId: admin.id,
      tx,
    });

    await tx.excusedAbsence.delete({ where: { id: record.id } });
  });

  // Clean up R2 document (best-effort)
  if (record.documentFileKey) {
    await deleteR2Object(record.documentFileKey).catch((err) => {
      console.error("Failed to delete R2 object:", record.documentFileKey, err);
    });
  }

  revalidatePath(`/students/${record.studentId}`);
  return { success: true };
}
