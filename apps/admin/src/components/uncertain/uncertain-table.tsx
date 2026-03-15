"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

type UncertainStudent = {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  level: string;
  uncertainFlaggedBy: string | null;
  uncertainComment: string | null;
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

const columns: ColumnDef<UncertainStudent>[] = [
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
    id: "group",
    header: "Group",
    cell: ({ row }) => {
      const memberships = row.original.groupMemberships;
      if (memberships.length === 0) {
        return <span className="text-sm text-muted-foreground">—</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {memberships.map((m) => (
            <Link key={m.id} href={`/groups/${m.group.id}`}>
              <Badge variant="outline" className="text-xs hover:bg-accent">
                {m.group.publicId}
              </Badge>
            </Link>
          ))}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "uncertainFlaggedBy",
    header: "Flagged By",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.uncertainFlaggedBy === "TEACHER" ? "Teacher" : "Admin"}
      </span>
    ),
  },
  {
    accessorKey: "uncertainComment",
    header: "Comment",
    cell: ({ row }) => {
      const comment = row.original.uncertainComment;
      if (!comment) return null;
      return (
        <span
          className="max-w-[200px] truncate text-sm text-muted-foreground"
          title={comment}
        >
          {comment}
        </span>
      );
    },
    enableSorting: false,
  },
];

export function UncertainTable({ data }: { data: UncertainStudent[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search by name..."
    />
  );
}
