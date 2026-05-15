import type { UrgencyInfo } from "@/lib/helpers/lead-staleness";

const CHIP_CLASS: Record<UrgencyInfo["tier"], string> = {
  red: "bg-red-100 text-red-800",
  green: "bg-green-100 text-green-800",
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  idle: "bg-muted text-muted-foreground",
};

export function LeadUrgencyChip({ info }: { info: UrgencyInfo }) {
  if (!info.chip) {
    // Reserve column space so rows stay aligned.
    return <span className="inline-block h-5 w-5" aria-hidden />;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHIP_CLASS[info.tier]}`}
    >
      {info.chip.label}
    </span>
  );
}
