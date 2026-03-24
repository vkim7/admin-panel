"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { getUploadPresignedUrl, getDownloadPresignedUrl, deleteR2Object } from "@/lib/r2";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const saveDocumentSchema = z.object({
  teacherId: z.string().min(1),
  fileName: z.string().min(1),
  fileKey: z.string().min(1),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
});

export async function getDocumentUploadUrl(
  teacherId: string,
  fileName: string,
  contentType: string,
) {
  await requireAdmin();

  if (!ALLOWED_TYPES.includes(contentType)) {
    return { error: "File type not allowed. Use PDF, JPEG, PNG, or WebP." };
  }

  const key = `teachers/${teacherId}/${Date.now()}-${fileName}`;
  const url = await getUploadPresignedUrl(key, contentType);

  return { url, key };
}

export async function saveTeacherDocument(data: unknown) {
  const admin = await requireAdmin();

  const parsed = saveDocumentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { teacherId, fileName, fileKey, fileSize } = parsed.data;

  await prisma.teacherDocument.create({
    data: {
      teacherId,
      fileName,
      fileKey,
      fileSize,
      uploadedById: admin.id,
    },
  });

  revalidatePath(`/teachers/${teacherId}`);
  return { success: true };
}

export async function deleteTeacherDocument(id: string) {
  await requireAdmin();

  const doc = await prisma.teacherDocument.findUnique({
    where: { id },
    select: { teacherId: true, fileKey: true },
  });

  if (!doc) return { error: "Document not found" };

  await deleteR2Object(doc.fileKey);
  await prisma.teacherDocument.delete({ where: { id } });

  revalidatePath(`/teachers/${doc.teacherId}`);
  return { success: true };
}

export async function getDocumentDownloadUrl(id: string) {
  await requireAdmin();

  const doc = await prisma.teacherDocument.findUnique({
    where: { id },
    select: { fileKey: true },
  });

  if (!doc) return { error: "Document not found" };

  const url = await getDownloadPresignedUrl(doc.fileKey);
  return { url };
}
