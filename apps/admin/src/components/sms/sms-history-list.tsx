import { Badge } from "@/components/ui/badge";
import type { SmsHistoryRow } from "@/lib/queries/sms";

const TEMPLATE_LABEL: Record<string, string> = {
  lead_greeting: "Greeting",
  lead_callback_reminder: "Callback reminder",
};

const STATUS_LABEL: Record<SmsHistoryRow["status"], string> = {
  SENT: "Sent",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

const STATUS_STYLE: Record<SmsHistoryRow["status"], string> = {
  SENT: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-slate-100 text-slate-600",
};

function formatTime(date: Date): string {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });
}

/**
 * Read-only timeline of outgoing SMS for a single lead or student.
 *
 * Whitespace in `message` is preserved via `whitespace-pre-wrap` so the
 * paragraph breaks we encoded in the templates render correctly.
 *
 * Status badge color hierarchy: DELIVERED (green) > SENT (blue) > FAILED
 * (red) > SKIPPED (gray). SKIPPED rows include a tooltip explaining the
 * SMS_ALLOWED_PHONES guardrail to staff who weren't around when the
 * allowlist was set.
 */
export function SmsHistoryList({ items }: { items: SmsHistoryRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        No messages sent yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const templateLabel = item.template?.code
          ? (TEMPLATE_LABEL[item.template.code] ?? item.template.code)
          : null;
        const senderLabel = item.sentBy
          ? `${item.sentBy.firstName} ${item.sentBy.lastName}`
          : "System";
        const isSkipped = item.status === "SKIPPED";

        return (
          <li
            key={item.id}
            className="rounded-md border bg-card p-3 text-sm space-y-2"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatTime(item.sentAt)}</span>
                <span>·</span>
                <span>{senderLabel}</span>
                {templateLabel && (
                  <>
                    <span>·</span>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {templateLabel} ({item.language})
                    </Badge>
                  </>
                )}
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[item.status]}`}
                title={
                  isSkipped
                    ? "SMS_ALLOWED_PHONES guardrail blocked this send — the trigger fired correctly but no SMS reached Eskiz."
                    : (item.failureReason ?? undefined)
                }
              >
                {STATUS_LABEL[item.status]}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-foreground leading-relaxed">
              {item.message}
            </p>
            {item.status === "FAILED" && item.failureReason && (
              <p className="text-xs text-red-600">{item.failureReason}</p>
            )}
            {item.status === "DELIVERED" && item.deliveredAt && (
              <p className="text-xs text-muted-foreground">
                Delivered {formatTime(item.deliveredAt)}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
