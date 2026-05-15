import type { LeadActivityType, LeadStatus } from "@eng/database";

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  LOST: "Lost",
};

function statusLabel(value: unknown): string {
  return STATUS_LABELS[value as LeadStatus] ?? String(value);
}

type Activity = {
  id: string;
  type: LeadActivityType;
  metadata: unknown;
  createdAt: Date;
  actor: { id: string; firstName: string; lastName: string } | null;
};

function formatDateTashkent(value: unknown): string {
  return new Date(String(value)).toLocaleString("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActivity(activity: Activity): string {
  const meta = (activity.metadata ?? {}) as Record<string, unknown>;

  switch (activity.type) {
    case "STATUS_CHANGE":
      return `Status: ${statusLabel(meta.from)} → ${statusLabel(meta.to)}`;
    case "CALLBACK_SET":
      return `Callback scheduled for ${formatDateTashkent(meta.at)}`;
    case "CALLBACK_DONE":
      return `Callback marked done`;
    case "TEST_SENT":
      return `Test sent (${String(meta.level)})`;
    case "TEST_SCORED":
      return `Test scored: ${String(meta.score)}/100 (${String(meta.level)})`;
    case "SCHEDULE_SET":
      return `Preferred schedule captured`;
    case "LOST":
      return `Marked as lost — ${String(meta.reason)}${meta.otherText ? `: ${String(meta.otherText)}` : ""}`;
    case "CONVERTED":
      return `Converted to student`;
    case "CONTACTED_VIA_PHONE":
      return `Called`;
    case "CONTACTED_VIA_TELEGRAM":
      return `Opened Telegram`;
    case "CONTACTED_VIA_WHATSAPP":
      return `Opened WhatsApp`;
    case "NOTE_UPDATED":
      return `Note updated`;
    default:
      return activity.type;
  }
}

function formatTimestamp(date: Date): string {
  return formatDateTashkent(date);
}

export function LeadActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No activity yet.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {activities.map((a) => (
        <li
          key={a.id}
          className="flex items-start gap-3 text-sm border-l-2 pl-3 py-0.5"
        >
          <div className="flex-1">
            <div>{formatActivity(a)}</div>
            <div className="text-xs text-muted-foreground">
              {formatTimestamp(a.createdAt)}
              {a.actor && ` · ${a.actor.firstName} ${a.actor.lastName}`}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
