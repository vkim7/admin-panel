"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";

type StudentRow = {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  level: string;
  status: string;
  groupMemberships: {
    id: string;
    group: { id: string; publicId: string; type: string; level: string };
  }[];
};

const LEVEL_SHORT: Record<string, string> = {
  BEGINNER: "Beg",
  ELEMENTARY: "Elem",
  PRE_INTERMEDIATE: "Pre-Int",
  INTERMEDIATE: "Int",
  UPPER_INTERMEDIATE: "Upper-Int",
  IELTS: "IELTS",
};

const columns: ColumnDef<StudentRow>[] = [
  {
    accessorKey: "crmCode",
    header: ({ column }) => (
      <SortableHeader column={column}>CRM</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.crmCode}</span>
    ),
  },
  {
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    id: "name",
    header: ({ column }) => (
      <SortableHeader column={column}>Name</SortableHeader>
    ),
    cell: ({ row }) => (
      <Link
        href={`/students/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.firstName} {row.original.lastName}
      </Link>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "level",
    header: "Level",
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {LEVEL_SHORT[row.original.level] ?? row.original.level}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge type="student" value={row.original.status} />
    ),
  },
  {
    id: "group",
    header: "Current Group",
    cell: ({ row }) => {
      const memberships = row.original.groupMemberships;
      if (memberships.length === 0) {
        return <span className="text-sm text-muted-foreground">—</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {memberships.map((m) => (
            <Badge key={m.id} variant="outline" className="text-xs">
              {m.group.publicId}
            </Badge>
          ))}
        </div>
      );
    },
    enableSorting: false,
  },
];

export function StudentTable({ data }: { data: StudentRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search by name..."
    />
  );
}
