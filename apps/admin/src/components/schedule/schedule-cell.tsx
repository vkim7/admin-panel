import Link from "next/link";
import type { ScheduleCell as ScheduleCellData } from "@/lib/queries/schedule";
import { LEVEL_SHORT } from "@/lib/constants";

export function ScheduleCell({ cell }: { cell: ScheduleCellData }) {
  // Effective count after scheduled actions resolve
  const effectiveCount =
    cell.activeCount - cell.scheduledDepartures + cell.scheduledArrivals;
  const isFull = effectiveCount >= cell.maxStudents;
  const unpaidCount = cell.activeCount - cell.paidCount;

  // Format: "4/6" or "4+1T/6"
  let countLabel = `${cell.activeCount}`;
  if (cell.trialCount > 0) {
    countLabel += `+${cell.trialCount}T`;
  }
  countLabel += `/${cell.maxStudents}`;

  // Level short + progress stage on one line (BEGINNING is implied, don't show)
  const levelLabel = LEVEL_SHORT[cell.level] ?? cell.level;
  const stageLabel =
    cell.progressStage === "MID" ? "MID" : cell.progressStage === "FINAL" ? "FIN" : null;

  const borderColor = isFull
    ? "border-green-300 bg-green-50"
    : "border-red-300 bg-red-50";

  return (
    <Link
      href={`/groups/${cell.groupId}`}
      className={`flex flex-col gap-0.5 rounded-md border p-2 text-xs transition-colors hover:opacity-80 ${borderColor}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">{cell.publicId}</span>
        {cell.language && (
          <span className="font-medium text-muted-foreground">{cell.language}</span>
        )}
      </div>
      <div className="font-medium text-foreground/70">
        {levelLabel}
        {stageLabel && ` · ${stageLabel}`}
      </div>
      <div className="text-muted-foreground">
        {countLabel}
        {cell.scheduledDepartures > 0 && (
          <span className="ml-1 text-red-600">↓{cell.scheduledDepartures}</span>
        )}
        {cell.scheduledArrivals > 0 && (
          <span className="ml-1 text-green-600">↑{cell.scheduledArrivals}</span>
        )}
        {unpaidCount > 0 && (
          <span className="font-medium text-red-600"> ({unpaidCount})</span>
        )}
      </div>
    </Link>
  );
}
