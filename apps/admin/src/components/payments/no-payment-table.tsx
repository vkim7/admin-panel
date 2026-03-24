"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { MONTH_NAMES } from "@/lib/constants";
import type { UnpaidPeriod } from "@/lib/queries/payments";

const LEVEL_SHORT: Record<string, string> = {
  BEGINNER: "Beg",
  ELEMENTARY: "Elem",
  PRE_INTERMEDIATE: "Pre-Int",
  INTERMEDIATE: "Int",
  UPPER_INTERMEDIATE: "Upper-Int",
  IELTS: "IELTS",
};

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US");
}

const columns: ColumnDef<UnpaidPeriod>[] = [
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
      <SortableHeader column={column}>Name</SortableHeader>
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
    accessorFn: (row) => row.student.level,
    id: "level",
    header: "Level",
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {LEVEL_SHORT[row.original.student.level] ?? row.original.student.level}
      </Badge>
    ),
  },
  {
    accessorFn: (row) => row.group.publicId,
    id: "group",
    header: "Group",
    cell: ({ row }) => (
      <Link
        href={`/groups/${row.original.group.id}`}
        className="text-sm hover:underline"
      >
        {row.original.group.publicId}
      </Link>
    ),
  },
  {
    accessorKey: "amountDue",
    header: ({ column }) => (
      <SortableHeader column={column}>Due</SortableHeader>
    ),
    cell: ({ row }) => {
      const { amountDue, discountAmount } = row.original;
      const effective = amountDue - discountAmount;
      return (
        <span className="text-sm">
          {formatUZS(effective)}
          {discountAmount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground line-through">
              {formatUZS(amountDue)}
            </span>
          )}
        </span>
      );
    },
  },
  {
    accessorKey: "amountPaid",
    header: ({ column }) => (
      <SortableHeader column={column}>Paid</SortableHeader>
    ),
    cell: ({ row }) => {
      const { amountPaid } = row.original;
      if (amountPaid === 0) return <span className="text-sm text-muted-foreground">—</span>;
      return <span className="text-sm">{formatUZS(amountPaid)}</span>;
    },
  },
  {
    id: "remaining",
    header: ({ column }) => (
      <SortableHeader column={column}>Remaining</SortableHeader>
    ),
    accessorFn: (row) => row.amountDue - row.discountAmount - row.amountPaid,
    cell: ({ row }) => {
      const { amountDue, discountAmount, amountPaid } = row.original;
      const remaining = amountDue - discountAmount - amountPaid;
      return (
        <span className="text-sm font-medium text-destructive">
          {formatUZS(remaining)}
        </span>
      );
    },
  },
  {
    id: "phone",
    header: "Phone",
    cell: ({ row }) => {
      const { phone } = row.original.student;
      const parentPhone = row.original.student.family?.parentPhone;
      return (
        <div className="text-sm">
          <div>{phone}</div>
          {parentPhone && parentPhone !== phone && (
            <div className="text-xs text-muted-foreground">{parentPhone}</div>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const p = row.original;
      return (
        <RecordPaymentDialog
          periodId={p.id}
          studentName={`${p.student.firstName} ${p.student.lastName}`}
          amountDue={p.amountDue}
          discountAmount={p.discountAmount}
          amountPaid={p.amountPaid}
          trigger={
            <Button variant="outline" size="sm">
              Record
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          }
        />
      );
    },
    enableSorting: false,
  },
];

interface NoPaymentTableProps {
  data: UnpaidPeriod[];
  currentYear: number;
  currentMonth: number;
}

export function NoPaymentTable({ data, currentYear, currentMonth }: NoPaymentTableProps) {
  const [search, setSearch] = useState("");

  // Custom filter: search by name, phone, and parent phone
  const filtered = search
    ? data.filter((p) => {
        const q = search.toLowerCase();
        const name = `${p.student.firstName} ${p.student.lastName}`.toLowerCase();
        const phone = p.student.phone.toLowerCase();
        const parentPhone = p.student.family?.parentPhone?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || parentPhone.includes(q);
      })
    : data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </span>
      </div>
      <DataTable columns={columns} data={filtered} pageSize={30} />
    </div>
  );
}
