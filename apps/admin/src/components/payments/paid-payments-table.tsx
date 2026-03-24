"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { MONTH_NAMES } from "@/lib/constants";
import type { PaidPayment } from "@/lib/queries/payments";

const METHOD_LABEL: Record<string, string> = {
  click: "Click",
  payme: "Payme",
  cash: "Cash",
  bank_transfer: "Bank Transfer",
};

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US");
}

const columns: ColumnDef<PaidPayment>[] = [
  {
    accessorFn: (row) => row.paidAt,
    id: "date",
    header: ({ column }) => (
      <SortableHeader column={column}>Date</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="text-sm">
        {new Date(row.original.paidAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.student.crmCode,
    id: "crmCode",
    header: ({ column }) => (
      <SortableHeader column={column}>CRM</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.student.crmCode}</span>
    ),
  },
  {
    accessorFn: (row) => `${row.student.firstName} ${row.student.lastName}`,
    id: "name",
    header: ({ column }) => (
      <SortableHeader column={column}>Student</SortableHeader>
    ),
    cell: ({ row }) => (
      <Link
        href={`/students/${row.original.student.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.student.firstName} {row.original.student.lastName}
      </Link>
    ),
  },
  {
    accessorFn: (row) => row.studentPaymentPeriod?.group.publicId ?? "—",
    id: "group",
    header: "Group",
    cell: ({ row }) => {
      const period = row.original.studentPaymentPeriod;
      if (!period) return <span className="text-sm text-muted-foreground">—</span>;
      return (
        <Link
          href={`/groups/${period.group.id}`}
          className="text-sm hover:underline"
        >
          {period.group.publicId}
        </Link>
      );
    },
  },
  {
    id: "period",
    header: "Period",
    cell: ({ row }) => {
      const period = row.original.studentPaymentPeriod;
      if (!period) return <span className="text-sm text-muted-foreground">—</span>;
      return (
        <span className="text-sm">
          {MONTH_NAMES[period.periodMonth]} {period.periodYear}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <SortableHeader column={column}>Amount</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {formatUZS(row.original.amount)}
      </span>
    ),
  },
  {
    accessorKey: "paymentMethod",
    id: "method",
    header: "Method",
    cell: ({ row }) => {
      const method = row.original.paymentMethod;
      if (!method) return <span className="text-sm text-muted-foreground">—</span>;
      return (
        <Badge variant="outline" className="text-xs">
          {METHOD_LABEL[method] ?? method}
        </Badge>
      );
    },
    enableSorting: false,
  },
  {
    id: "recordedBy",
    header: "Recorded By",
    cell: ({ row }) => {
      const admin = row.original.recordedBy;
      if (!admin) return <span className="text-sm text-muted-foreground">—</span>;
      return (
        <span className="text-sm text-muted-foreground">
          {admin.firstName} {admin.lastName}
        </span>
      );
    },
    enableSorting: false,
  },
];

interface PaidPaymentsTableProps {
  data: PaidPayment[];
  currentYear: number;
  currentMonth: number;
}

export function PaidPaymentsTable({ data, currentYear, currentMonth }: PaidPaymentsTableProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? data.filter((p) => {
        const q = search.toLowerCase();
        const name = `${p.student.firstName} ${p.student.lastName}`.toLowerCase();
        const crm = p.student.crmCode.toLowerCase();
        return name.includes(q) || crm.includes(q);
      })
    : data;

  // Sum total amount
  const totalAmount = filtered.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by name or CRM..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {MONTH_NAMES[currentMonth]} {currentYear} · Total: {formatUZS(totalAmount)} UZS
        </span>
      </div>
      <DataTable columns={columns} data={filtered} pageSize={30} />
    </div>
  );
}
