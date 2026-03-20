"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { RefundRow } from "@/lib/queries/refunds";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProcessRefundDialog } from "./process-refund-dialog";
import { ConvertToCreditDialog } from "./convert-to-credit-dialog";

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US");
}

const columns: ColumnDef<RefundRow>[] = [
  {
    accessorKey: "student",
    header: "Student",
    cell: ({ row }) => {
      const s = row.original.student;
      return (
        <Link
          href={`/students/${s.id}`}
          className="text-primary hover:underline"
        >
          {s.crmCode} — {s.firstName} {s.lastName}
        </Link>
      );
    },
    filterFn: (row, _id, value) => {
      const s = row.original.student;
      const text = `${s.crmCode} ${s.firstName} ${s.lastName}`.toLowerCase();
      return text.includes(String(value).toLowerCase());
    },
  },
  {
    accessorKey: "group",
    header: "Group",
    cell: ({ row }) => row.original.studentPaymentPeriod.group.publicId,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <SortableHeader column={column}>Amount</SortableHeader>
    ),
    cell: ({ row }) => formatUZS(row.original.amount) + " UZS",
  },
  {
    accessorKey: "initiatedAt",
    header: ({ column }) => (
      <SortableHeader column={column}>Initiated</SortableHeader>
    ),
    cell: ({ row }) =>
      new Date(row.original.initiatedAt).toLocaleDateString("en-GB"),
  },
  {
    accessorKey: "initiatedBy",
    header: "By",
    cell: ({ row }) => {
      const a = row.original.initiatedBy;
      return `${a.firstName} ${a.lastName}`;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge type="refund" value={row.original.status} />
    ),
  },
  {
    accessorKey: "amountRefunded",
    header: "Refunded",
    cell: ({ row }) => {
      if (row.original.status !== "COMPLETED") return "—";
      const amt = row.original.amountRefunded;
      if (amt === 0) return "Converted to credit";
      return amt != null ? formatUZS(amt) + " UZS" : "—";
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      if (row.original.status !== "PENDING") return null;
      return (
        <div className="flex gap-1">
          <ProcessRefundDialog refund={row.original} />
          <ConvertToCreditDialog refund={row.original} />
        </div>
      );
    },
  },
];

interface RefundTableProps {
  data: RefundRow[];
}

export function RefundTable({ data }: RefundTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="student"
      searchPlaceholder="Search by student name or CRM code..."
    />
  );
}
