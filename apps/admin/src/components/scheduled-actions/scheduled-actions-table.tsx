"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { ScheduledActionRow } from "@/lib/queries/scheduled-actions";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cancelScheduledAction, executeScheduledActionNow } from "@/lib/actions/scheduled-actions";

const TYPE_LABELS: Record<string, string> = {
  TRANSFER: "Transfer",
  SEND_TO_REASSIGNMENT: "Reassignment",
  SEND_TO_LOST: "Lost List",
  DEACTIVATE: "Deactivate",
  MERGE_GROUP: "Merge Group",
};

const STATUS_OPTIONS = ["ALL", "PENDING", "COMPLETED", "FAILED", "CANCELLED"] as const;

function ActionButtons({ row }: { row: ScheduledActionRow }) {
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (row.status !== "PENDING") return null;

  return (
    <>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExecuteOpen(true)}
        >
          Execute
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setCancelOpen(true)}
        >
          Cancel
        </Button>
      </div>

      {/* Execute Now confirmation */}
      <Dialog open={executeOpen} onOpenChange={setExecuteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute Now</DialogTitle>
            <DialogDescription>
              Execute this {TYPE_LABELS[row.type]?.toLowerCase() ?? row.type} action immediately?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteOpen(false)}>
              Back
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await executeScheduledActionNow(row.id);
                  if (result?.error) {
                    toast.error(result.error);
                  } else {
                    toast.success("Action executed successfully");
                    setExecuteOpen(false);
                  }
                });
              }}
            >
              {isPending ? "Executing..." : "Execute Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog
        open={cancelOpen}
        onOpenChange={(v) => {
          setCancelOpen(v);
          if (!v) setCancelReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Scheduled Action</DialogTitle>
            <DialogDescription>
              Cancel this {TYPE_LABELS[row.type]?.toLowerCase() ?? row.type} action scheduled for{" "}
              {new Date(row.effectiveDate).toLocaleDateString("en-GB")}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (optional)</label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this being cancelled?"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await cancelScheduledAction({
                    id: row.id,
                    cancelReason: cancelReason || null,
                  });
                  if (result?.error) {
                    toast.error(result.error);
                  } else {
                    toast.success("Action cancelled");
                    setCancelOpen(false);
                  }
                });
              }}
            >
              {isPending ? "Cancelling..." : "Cancel Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const columns: ColumnDef<ScheduledActionRow>[] = [
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => TYPE_LABELS[row.original.type] ?? row.original.type,
  },
  {
    accessorKey: "student",
    header: "Student",
    cell: ({ row }) => {
      const s = row.original.student;
      if (!s) return "—";
      return (
        <Link href={`/students/${s.id}`} className="text-primary hover:underline">
          {s.crmCode} — {s.firstName} {s.lastName}
        </Link>
      );
    },
    filterFn: (row, _id, value) => {
      const s = row.original.student;
      if (!s) return false;
      const text = `${s.crmCode} ${s.firstName} ${s.lastName}`.toLowerCase();
      return text.includes(String(value).toLowerCase());
    },
  },
  {
    accessorKey: "sourceGroup",
    header: "Source",
    cell: ({ row }) => {
      const g = row.original.sourceGroup ?? row.original.membership?.group;
      if (!g) return "—";
      return g.publicId;
    },
  },
  {
    accessorKey: "destGroup",
    header: "Destination",
    cell: ({ row }) => row.original.destGroup?.publicId ?? "—",
  },
  {
    accessorKey: "effectiveDate",
    header: ({ column }) => <SortableHeader column={column}>Effective Date</SortableHeader>,
    cell: ({ row }) =>
      new Date(row.original.effectiveDate).toLocaleDateString("en-GB"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge type="scheduledAction" value={row.original.status} />
    ),
  },
  {
    accessorKey: "createdBy",
    header: "Created By",
    cell: ({ row }) => {
      const a = row.original.createdBy;
      return `${a.firstName} ${a.lastName}`;
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortableHeader column={column}>Created</SortableHeader>,
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString("en-GB"),
  },
  {
    id: "failureReason",
    header: "Failure / Cancel",
    cell: ({ row }) => {
      const r = row.original;
      if (r.failureReason) return <span className="text-red-600 text-xs">{r.failureReason}</span>;
      if (r.cancelReason) return <span className="text-muted-foreground text-xs">{r.cancelReason}</span>;
      return "—";
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <ActionButtons row={row.original} />,
  },
];

interface ScheduledActionsTableProps {
  data: ScheduledActionRow[];
}

export function ScheduledActionsTable({ data }: ScheduledActionsTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = statusFilter === "ALL"
    ? data
    : data.filter((a) => a.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        searchKey="student"
        searchPlaceholder="Search by student name or CRM code..."
        initialSorting={[{ id: "effectiveDate", desc: false }]}
      />
    </div>
  );
}
