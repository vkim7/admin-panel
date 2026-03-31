"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { CopyZoomButton } from "@/components/copy-zoom-button";
import { getAge } from "@/lib/helpers/date";

type StudentRow = {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: Date;
  level: string;
  status: string;
  family: { parentPhone: string | null } | null;
  groupMemberships: {
    id: string;
    group: { id: string; publicId: string; type: string; level: string; zoomLink: string | null };
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
    id: "age",
    header: "Age",
    accessorFn: (row) => getAge(row.dateOfBirth),
    cell: ({ getValue }) => (
      <span className="text-sm">{getValue<number>()}</span>
    ),
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
        <div className="flex flex-col gap-1">
          {memberships.map((m) => (
            <span key={m.id} className="flex items-center gap-1">
              <Link href={`/groups/${m.group.id}`} className="text-muted-foreground hover:underline text-sm">
                {m.group.publicId}
              </Link>
              <CopyZoomButton zoomLink={m.group.zoomLink} />
            </span>
          ))}
        </div>
      );
    },
    enableSorting: false,
  },
];

export function StudentTable({ data }: { data: StudentRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? data.filter((s) => {
        const q = search.toLowerCase();
        const name = `${s.firstName} ${s.lastName}`.toLowerCase();
        const phone = s.phone.toLowerCase();
        const parentPhone = s.family?.parentPhone?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || parentPhone.includes(q);
      })
    : data;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <DataTable columns={columns} data={filtered} />
    </div>
  );
}
