"use server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/server/db";

/**
 * Server action to fetch recordings for a lesson (called from client component).
 * Note: this is a read operation exposed as a server action because it's called
 * from a client component (lesson detail dialog) that can't call queries directly.
 */
export async function getRecordingsForLesson(lessonId: string) {
  await requireAdmin();

  const recordings = await prisma.recording.findMany({
    where: { lessonId },
    select: {
      id: true,
      fileType: true,
      recordingType: true,
      r2Key: true,
      fileSizeBytes: true,
      durationSeconds: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Convert BigInt to number for serialization over the wire
  return recordings.map((r) => ({
    ...r,
    fileSizeBytes: Number(r.fileSizeBytes),
  }));
}
