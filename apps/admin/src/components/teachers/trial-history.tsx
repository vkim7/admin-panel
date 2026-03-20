"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { TrialHistoryEntry } from "@/lib/queries/teachers";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
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
} as const;

export function TrialHistory({ trials }: { trials: TrialHistoryEntry[] }) {
  if (trials.length === 0) return null;

  const committed = trials.filter((t) => t.status === "committed").length;
  const pending = trials.filter((t) => t.status === "pending").length;
  const didntContinue = trials.filter((t) => t.status === "didnt_continue").length;
  const noShow = trials.filter((t) => t.status === "no_show").length;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Trial History</h3>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>{committed} committed</span>
        <span>{pending} pending</span>
        <span>{didntContinue} didn&apos;t continue</span>
        <span>{noShow} no-show</span>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Student</th>
              <th className="px-3 py-2 text-left font-medium">Group</th>
              <th className="px-3 py-2 text-left font-medium">Trial Date</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Actual Teacher</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t) => {
              const cfg = STATUS_CONFIG[t.status];
              return (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/students/${t.student.id}`}
                      className="text-primary hover:underline"
                    >
                      <span className="mr-1 font-mono text-xs text-muted-foreground">
                        {t.student.crmCode}
                      </span>
                      {t.student.firstName} {t.student.lastName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/groups/${t.group.id}`}
                      className="text-primary hover:underline"
                    >
                      {t.group.publicId}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {new Date(t.joinDate).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-3 py-2">
                    {t.group.type === "INDIVIDUAL" ? "Individual" : "Group"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={cfg.className}>
                      {cfg.label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.actualTeacherName ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
