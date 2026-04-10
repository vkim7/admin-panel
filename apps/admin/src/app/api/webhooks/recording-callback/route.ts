import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { deleteZoomRecording } from "@/lib/zoom";

const CALLBACK_SECRET = process.env.RECORDING_CALLBACK_SECRET!;

export async function POST(request: Request) {
  // Validate shared secret
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CALLBACK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { recordingId, status, fileSizeBytes, error } = body as {
    recordingId: string;
    status: "completed" | "failed";
    fileSizeBytes?: number;
    error?: string;
  };

  if (!recordingId || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      zoomFileId: true,
      status: true,
      group: {
        select: { zoomMeetingId: true },
      },
    },
  });

  if (!recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  // Already processed
  if (recording.status === "COMPLETED") {
    return NextResponse.json({ status: "already_completed" });
  }

  if (status === "completed") {
    // Mark as completed
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: "COMPLETED",
        ...(fileSizeBytes ? { fileSizeBytes: BigInt(fileSizeBytes) } : {}),
      },
    });

    // Best-effort: delete recording from Zoom cloud to free storage
    const zoomMeetingId = recording.group.zoomMeetingId;
    if (zoomMeetingId) {
      await deleteZoomRecording(zoomMeetingId, recording.zoomFileId);
    }
  } else {
    // Mark as failed
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: "FAILED" },
    });
    console.error(
      `[Recording Callback] Download failed for ${recordingId}: ${error ?? "unknown"}`,
    );
  }

  return NextResponse.json({ status: "ok" });
}
