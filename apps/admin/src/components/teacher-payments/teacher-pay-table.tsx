"use client";

import { useMemo, useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LEVEL_SHORT, STAGE_SHORT } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  markTeacherPaid,
  markGroupPayPaid,
} from "@/lib/actions/teacher-payments";
import type { TeacherPayPeriodRow } from "@/lib/queries/teacher-payments";

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US");
}

/** One row per teacher — aggregated from per-group records. */
type TeacherPayRow = {
  teacherId: string;
  teacherName: string;
  groupCount: number;
  totalLessons: number;
  totalStudentLessons: number;
  totalAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  paidAt: Date | null;
  records: TeacherPayPeriodRow[];
};

function aggregateByTeacher(data: TeacherPayPeriodRow[]): TeacherPayRow[] {
  const map = new Map<string, TeacherPayRow>();

  for (const r of data) {
    const existing = map.get(r.teacherId);
    if (existing) {
      existing.groupCount++;
      existing.totalLessons += r.lessonsCompleted;
      existing.totalStudentLessons += r.totalStudentLessons;
      existing.totalAmount += r.amount;
      existing.records.push(r);
    } else {
      map.set(r.teacherId, {
        teacherId: r.teacherId,
        teacherName: `${r.teacher.firstName} ${r.teacher.lastName}`,
        groupCount: 1,
        totalLessons: r.lessonsCompleted,
        totalStudentLessons: r.totalStudentLessons,
        totalAmount: r.amount,
        status: "UNPAID",
        paidAt: null,
        records: [r],
      });
    }
  }

  for (const row of map.values()) {
    const paidCount = row.records.filter((r) => r.status === "PAID").length;
    if (paidCount === row.records.length) {
      row.status = "PAID";
      const dates = row.records
        .map((r) => r.paidAt)
        .filter((d): d is Date => d != null);
      row.paidAt =
        dates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    } else if (paidCount > 0) {
      row.status = "PARTIAL";
    } else {
      row.status = "UNPAID";
    }
  }

  return [...map.values()].sort((a, b) =>
    a.teacherName.localeCompare(b.teacherName),
  );
}

// ── Confirmation dialog (nested inside parent dialog) ───────────────────────

function ConfirmPayDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "Marking..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Per-group pay button (inside the dialog table) ──────────────────────────

function PayGroupButton({
  id,
  groupPublicId,
  amount,
}: {
  id: string;
  groupPublicId: string;
  amount: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await markGroupPayPaid({ id });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${formatUZS(amount)} UZS marked as paid`);
        setConfirmOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setConfirmOpen(true)}
      >
        Pay
        <ArrowRight className="ml-0.5 size-3" />
      </Button>
      <ConfirmPayDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Pay for ${groupPublicId}`}
        description={`Mark ${formatUZS(amount)} UZS as paid for group ${groupPublicId}?`}
        onConfirm={handleConfirm}
        isPending={isPending}
      />
    </>
  );
}

// ── Main pay dialog ─────────────────────────────────────────────────────────

function PayTeacherDialog({
  row,
  year,
  month,
}: {
  row: TeacherPayRow;
  year: number;
  month: number;
}) {
  const [open, setOpen] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const unpaidRecords = row.records.filter((r) => r.status === "UNPAID");
  const unpaidTotal = unpaidRecords.reduce((sum, r) => sum + r.amount, 0);

  function handlePayAll() {
    startTransition(async () => {
      const result = await markTeacherPaid({
        teacherId: row.teacherId,
        year,
        month,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `${row.teacherName} — ${formatUZS(unpaidTotal)} UZS marked as paid`,
        );
        setConfirmAllOpen(false);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Pay
          <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pay {row.teacherName}</DialogTitle>
          <DialogDescription>
            {row.groupCount} group{row.groupCount > 1 ? "s" : ""} &middot;{" "}
            {row.totalLessons} lessons &middot;{" "}
            {row.totalStudentLessons} student-lessons &middot;{" "}
            Total: {formatUZS(row.totalAmount)} UZS
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Group</th>
                <th className="px-3 py-2 text-left font-medium">Level</th>
                <th className="px-3 py-2 text-left font-medium">Lessons</th>
                <th className="px-3 py-2 text-left font-medium">Std-Lessons</th>
                <th className="px-3 py-2 text-left font-medium">Rate</th>
                <th className="px-3 py-2 text-left font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {row.records.map((r) => {
                const levelLabel = LEVEL_SHORT[r.group.level] ?? r.group.level;
                const stageLabel = STAGE_SHORT[r.group.progressStage] ?? r.group.progressStage;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/groups/${r.group.id}`}
                        className="hover:underline"
                      >
                        {r.group.publicId}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {levelLabel} &middot; {stageLabel}
                    </td>
                    <td className="px-3 py-2">{r.lessonsCompleted}</td>
                    <td className="px-3 py-2">{r.totalStudentLessons}</td>
                    <td className="px-3 py-2">{formatUZS(r.rate)}</td>
                    <td className="px-3 py-2 font-medium">
                      {formatUZS(r.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        type="teacherPay"
                        value={r.status}
                        className="text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "UNPAID" && (
                        <PayGroupButton
                          id={r.id}
                          groupPublicId={r.group.publicId}
                          amount={r.amount}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          {unpaidRecords.length > 0 && (
            <Button onClick={() => setConfirmAllOpen(true)}>
              Pay All {formatUZS(unpaidTotal)} UZS
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <ConfirmPayDialog
        open={confirmAllOpen}
        onOpenChange={setConfirmAllOpen}
        title={`Pay all for ${row.teacherName}`}
        description={`Mark all ${unpaidRecords.length} unpaid record${unpaidRecords.length > 1 ? "s" : ""} (${formatUZS(unpaidTotal)} UZS) as paid?`}
        onConfirm={handlePayAll}
        isPending={isPending}
      />
    </Dialog>
  );
}

// ── Table columns & component ───────────────────────────────────────────────

const columns: ColumnDef<TeacherPayRow>[] = [
  {
    accessorKey: "teacherName",
    id: "teacher",
    header: ({ column }) => (
      <SortableHeader column={column}>Teacher</SortableHeader>
    ),
    cell: ({ row }) => (
      <Link
        href={`/teachers/${row.original.teacherId}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.teacherName}
      </Link>
    ),
  },
  {
    accessorKey: "groupCount",
    header: "Groups",
  },
  {
    accessorKey: "totalLessons",
    header: ({ column }) => (
      <SortableHeader column={column}>Lessons</SortableHeader>
    ),
  },
  {
    accessorKey: "totalStudentLessons",
    header: ({ column }) => (
      <SortableHeader column={column}>Std-Lessons</SortableHeader>
    ),
  },
  {
    accessorKey: "totalAmount",
    header: ({ column }) => (
      <SortableHeader column={column}>Amount</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {formatUZS(row.original.totalAmount)} UZS
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const { status, paidAt } = row.original;
      return (
        <div>
          <StatusBadge type="teacherPay" value={status} className="text-xs" />
          {status === "PAID" && paidAt && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {new Date(paidAt).toLocaleDateString("en-GB")}
            </p>
          )}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: () => null,
    enableSorting: false,
  },
];

interface TeacherPayTableProps {
  data: TeacherPayPeriodRow[];
  year: number;
  month: number;
}

export function TeacherPayTable({ data, year, month }: TeacherPayTableProps) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => aggregateByTeacher(data), [data]);

  const filtered = search
    ? rows.filter((r) =>
        r.teacherName.toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  const columnsWithActions = useMemo(
    () =>
      columns.map((col) =>
        col.id === "actions"
          ? {
              ...col,
              cell: ({ row }: { row: { original: TeacherPayRow } }) => {
                if (row.original.status === "PAID") return null;
                return (
                  <PayTeacherDialog
                    row={row.original}
                    year={year}
                    month={month}
                  />
                );
              },
            }
          : col,
      ),
    [year, month],
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by teacher name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <DataTable
        columns={columnsWithActions}
        data={filtered}
        pageSize={30}
        initialSorting={[{ id: "teacher", desc: false }]}
      />
    </div>
  );
}
