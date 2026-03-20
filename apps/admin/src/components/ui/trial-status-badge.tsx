import { Badge } from "@/components/ui/badge";

type TrialStatus = "committed" | "didnt_continue" | "no_show";

const CONFIG: Record<TrialStatus, { label: string; className: string }> = {
  committed: {
    label: "Committed",
    className: "border-green-200 bg-green-50 text-green-700",
  },
  didnt_continue: {
    label: "Didn't continue",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  no_show: {
    label: "No-show",
    className: "border-gray-200 bg-gray-50 text-gray-500",
  },
};

/**
 * Derive trial outcome status from membership fields + attendance.
 * Only call for memberships with wasTrialOriginally=true AND leaveDate set.
 */
export function getTrialStatus(isTrial: boolean, hasAttendance: boolean): TrialStatus {
  if (!isTrial) return "committed";
  if (hasAttendance) return "didnt_continue";
  return "no_show";
}

export function TrialStatusBadge({ status }: { status: TrialStatus }) {
  const cfg = CONFIG[status];
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
