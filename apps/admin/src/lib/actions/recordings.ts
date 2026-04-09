"use server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/server/db";
import { getDownloadPresignedUrl } from "@/lib/r2";

export async function getRecordingUrl(
  recordingId: string,
): Promise<{ url?: string; error?: string }> {
  await requireAdmin();

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { r2Key: true, status: true },
  });

  if (!recording) {
    return { error: "Recording not found" };
  }

  if (recording.status !== "COMPLETED") {
    return { error: "Recording is not ready yet" };
  }

  const url = await getDownloadPresignedUrl(recording.r2Key);
  return { url };
}
