import { prisma } from "@/server/db";

/**
 * Get all recordings for a set of lessons (for the lesson grid).
 * Returns a map of lessonId → recording count for quick lookup.
 */
export async function getRecordingCountsForGroup(
  groupId: string,
): Promise<Map<string, number>> {
  const results = await prisma.recording.groupBy({
    by: ["lessonId"],
    where: {
      lesson: { groupId },
      status: { in: ["COMPLETED", "PENDING", "DOWNLOADING"] },
    },
    _count: { id: true },
  });

  const map = new Map<string, number>();
  for (const r of results) {
    map.set(r.lessonId, r._count.id);
  }
  return map;
}

/**
 * Get detailed recordings for a specific lesson (for the recording popover).
 */
export async function getRecordingsForLesson(lessonId: string) {
  return prisma.recording.findMany({
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
}

export type RecordingDetail = Awaited<ReturnType<typeof getRecordingsForLesson>>[number];
