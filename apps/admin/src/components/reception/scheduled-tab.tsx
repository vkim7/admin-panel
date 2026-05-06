"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ScheduledAssignmentRow } from "@/lib/queries/reception";

interface ScheduledTabProps {
  data: ScheduledAssignmentRow[];
}

const GROUP_TYPE_LABEL: Record<string, string> = {
  GROUP: "Group",
  INDIVIDUAL: "Individual",
};

export function ScheduledTab({ data }: ScheduledTabProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scheduled assignments. Future-dated assignments from Reception will appear here until they execute.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link
          href="/scheduled-actions"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Manage in Scheduled Actions
          <ExternalLink className="size-3" />
        </Link>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CRM</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead>Scheduled By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.scheduledActionId}>
                <TableCell className="font-mono">{row.crmCode}</TableCell>
                <TableCell>
                  <Link
                    href={`/students/${row.studentId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.firstName} {row.lastName}
                  </Link>
                </TableCell>
                <TableCell>{row.phone ?? "—"}</TableCell>
                <TableCell>
                  <Link
                    href={`/groups/${row.destGroupId}`}
                    className="text-muted-foreground hover:underline"
                  >
                    {row.destGroupPublicId}
                  </Link>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {GROUP_TYPE_LABEL[row.destGroupType] ?? row.destGroupType}
                  </span>
                </TableCell>
                <TableCell>{row.effectiveDate.toLocaleDateString("en-GB")}</TableCell>
                <TableCell className="text-muted-foreground">{row.createdByName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
