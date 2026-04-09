"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Video, Music, FileText, Clock, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecordingUrl } from "@/lib/actions/recordings";
/** Recording detail from server action (BigInt serialized to number). */
interface RecordingItem {
  id: string;
  fileType: string;
  recordingType: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  status: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case "MP4":
      return <Video className="size-4 text-blue-600" />;
    case "M4A":
      return <Music className="size-4 text-purple-600" />;
    default:
      return <FileText className="size-4 text-muted-foreground" />;
  }
}

function getFileLabel(fileType: string, recordingType: string): string {
  if (fileType === "MP4") {
    if (recordingType.includes("gallery")) return "Video (Gallery)";
    if (recordingType.includes("speaker")) return "Video (Speaker)";
    if (recordingType.includes("screen")) return "Video (Screen)";
    return "Video";
  }
  if (fileType === "M4A") return "Audio";
  if (fileType === "CHAT") return "Chat Log";
  if (fileType === "TRANSCRIPT") return "Transcript";
  if (fileType === "TIMELINE") return "Timeline";
  return fileType;
}

function RecordingRow({ recording }: { recording: RecordingItem }) {
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    startTransition(async () => {
      const result = await getRecordingUrl(recording.id);
      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        window.open(result.url, "_blank");
      }
    });
  }

  const isReady = recording.status === "COMPLETED";
  const isProcessing =
    recording.status === "PENDING" || recording.status === "DOWNLOADING";

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2">
        {getFileIcon(recording.fileType)}
        <div>
          <span className="text-sm">
            {getFileLabel(recording.fileType, recording.recordingType)}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            {formatFileSize(recording.fileSizeBytes)}
            {recording.durationSeconds != null &&
              ` · ${formatDuration(recording.durationSeconds)}`}
          </span>
        </div>
      </div>
      {isReady ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={handleOpen}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ExternalLink className="size-3.5" />
          )}
          Open
        </Button>
      ) : isProcessing ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          Processing
        </span>
      ) : (
        <span className="text-xs text-red-500">Failed</span>
      )}
    </div>
  );
}

export function RecordingList({
  recordings,
}: {
  recordings: RecordingItem[];
}) {
  if (recordings.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Recordings</p>
      {recordings.map((r) => (
        <RecordingRow key={r.id} recording={r} />
      ))}
    </div>
  );
}
