import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/server/db";

const WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET_TOKEN!;
const WORKER_URL = process.env.RECORDING_WORKER_URL!;
const CALLBACK_SECRET = process.env.RECORDING_CALLBACK_SECRET!;

// ─── CRC validation ──────────────────────────────────────────────────────────

function hashToken(plainToken: string): string {
  return crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(plainToken)
    .digest("hex");
}

// ─── File extension from Zoom file type ──────────────────────────────────────

function getExtension(fileType: string): string {
  const map: Record<string, string> = {
    MP4: "mp4",
    M4A: "m4a",
    CHAT: "txt",
    TRANSCRIPT: "vtt",
    TIMELINE: "json",
    CC: "vtt",
  };
  return map[fileType] ?? fileType.toLowerCase();
}

// ─── Webhook handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json();

  // CRC challenge-response (Zoom periodically re-validates the endpoint)
  if (body.event === "endpoint.url_validation") {
    const plainToken = body.payload?.plainToken;
    if (!plainToken) {
      return NextResponse.json({ error: "Missing plainToken" }, { status: 400 });
    }
    return NextResponse.json({
      plainToken,
      encryptedToken: hashToken(plainToken),
    });
  }

  // Only handle recording.completed
  if (body.event !== "recording.completed") {
    return NextResponse.json({ status: "ignored" });
  }

  const meetingObj = body.payload?.object;
  if (!meetingObj) {
    return NextResponse.json({ error: "Missing payload.object" }, { status: 400 });
  }

  const zoomMeetingId = String(meetingObj.id);
  const recordingFiles: Array<{
    id: string;
    file_type: string;
    file_size: number;
    download_url: string;
    recording_start: string;
    recording_end: string;
    recording_type: string;
  }> = meetingObj.recording_files ?? [];

  if (recordingFiles.length === 0) {
    return NextResponse.json({ status: "no_files" });
  }

  // Match meeting to group
  const group = await prisma.group.findFirst({
    where: { zoomMeetingId },
    select: { id: true },
  });

  if (!group) {
    console.error(`[Zoom Webhook] No group found for meeting ${zoomMeetingId}`);
    return NextResponse.json({ status: "no_group" });
  }

  // Match to lesson by recording start date (may be null if no lesson on that day)
  const recordingStart = new Date(recordingFiles[0]!.recording_start);
  const recordingDate = new Date(
    Date.UTC(
      recordingStart.getUTCFullYear(),
      recordingStart.getUTCMonth(),
      recordingStart.getUTCDate(),
    ),
  );

  const lesson = await prisma.lesson.findFirst({
    where: {
      groupId: group.id,
      lessonDate: recordingDate,
    },
    select: { id: true },
  });

  if (!lesson) {
    console.log(
      `[Zoom Webhook] No lesson found for group ${group.id} on ${recordingDate.toISOString()} — storing as orphan recording`,
    );
  }

  // Zoom includes a download_token (JWT, valid 24h) at the root of the webhook
  // payload. This is the ONLY token that works for downloading recording files —
  // S2S OAuth tokens are rejected by Zoom's download server.
  const downloadToken: string | undefined = body.download_token;
  if (!downloadToken) {
    console.error("[Zoom Webhook] No download_token in webhook payload");
    return NextResponse.json({ error: "Missing download_token" }, { status: 400 });
  }

  // Create Recording rows and dispatch to Worker
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  for (const file of recordingFiles) {
    const ext = getExtension(file.file_type);
    const timestamp = file.recording_start.split("T")[0] ?? "unknown";
    const folder = lesson ? lesson.id : `orphan_${timestamp}`;
    const r2Key = `recordings/${group.id}/${folder}/${file.file_type}_${timestamp}.${ext}`;

    const durationSeconds =
      file.recording_start && file.recording_end
        ? Math.round(
            (new Date(file.recording_end).getTime() -
              new Date(file.recording_start).getTime()) /
              1000,
          )
        : null;

    // Create PENDING recording row
    const recording = await prisma.recording.create({
      data: {
        groupId: group.id,
        lessonId: lesson?.id ?? null,
        recordingDate,
        fileType: file.file_type,
        recordingType: file.recording_type,
        r2Key,
        fileSizeBytes: BigInt(file.file_size),
        durationSeconds,
        status: "PENDING",
        zoomFileId: file.id,
      },
    });

    // Dispatch to Cloudflare Worker (fire-and-forget, Worker calls back)
    try {
      await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CALLBACK_SECRET}`,
        },
        body: JSON.stringify({
          zoomDownloadUrl: file.download_url,
          zoomDownloadToken: downloadToken,
          r2Key,
          recordingId: recording.id,
          callbackUrl: `${appBaseUrl}/api/webhooks/recording-callback`,
          callbackSecret: CALLBACK_SECRET,
        }),
      });
    } catch (error) {
      console.error(
        `[Zoom Webhook] Failed to dispatch to Worker for recording ${recording.id}:`,
        error,
      );
      // Recording stays PENDING — can be retried later
    }
  }

  return NextResponse.json({ status: "ok", recordings: recordingFiles.length });
}
