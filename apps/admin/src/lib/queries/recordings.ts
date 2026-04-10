import { prisma } from "@/server/db";

/**
 * Get recording counts per lesson for the lesson grid.
 * Returns a map of lessonId → recording count.
 */
export async function getRecordingCountsForGroup(
  groupId: string,
): Promise<Map<string, number>> {
  const results = await prisma.recording.groupBy({
    by: ["lessonId"],
    where: {
      groupId,
      lessonId: { not: null },
      status: { in: ["COMPLETED", "PENDING", "DOWNLOADING"] },
    },
    _count: { id: true },
  });

  const map = new Map<string, number>();
  for (const r of results) {
    if (r.lessonId) map.set(r.lessonId, r._count.id);
  }
  return map;
}

/**
 * Get orphan recordings (no matching lesson) for a group.
 */
export async function getOrphanRecordingsForGroup(groupId: string) {
  return prisma.recording.findMany({
    where: {
      groupId,
      lessonId: null,
      status: { in: ["COMPLETED", "PENDING", "DOWNLOADING"] },
    },
    select: {
      id: true,
      recordingDate: true,
      fileType: true,
      recordingType: true,
      fileSizeBytes: true,
      durationSeconds: true,
      status: true,
      createdAt: true,
    },
    orderBy: { recordingDate: "desc" },
  });
}

export type OrphanRecording = Awaited<ReturnType<typeof getOrphanRecordingsForGroup>>[number];
