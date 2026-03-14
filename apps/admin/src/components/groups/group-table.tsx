"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LEVEL_SHORT, DAYS_LABEL } from "@/lib/constants";

type GroupRow = {
  id: string;
  publicId: string;
  type: string;
  level: string;
  progressStage: string; // computed server-side
  startTime: string;
  days: number[];
  maxStudents: number;
  isActive: boolean;
  teacher: { id: string; firstName: string; lastName: string };
  memberships: { id: string }[];
};


const columns: ColumnDef<GroupRow>[] = [
  {
    accessorKey: "publicId",
    header: ({ column }) => (
      <SortableHeader column={column}>ID</SortableHeader>
    ),
    cell: ({ row }) => (
      <Link
        href={`/groups/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.publicId}
      </Link>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.type === "INDIVIDUAL" ? "Individual" : "Group"}
      </span>
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
    accessorKey: "progressStage",
    header: "Stage",
    cell: ({ row }) => (
      <StatusBadge type="group" value={row.original.progressStage} />
    ),
  },
  {
    id: "teacher",
    header: "Teacher",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.teacher.firstName} {row.original.teacher.lastName}
      </span>
    ),
    enableSorting: false,
  },
  {
    id: "schedule",
    header: "Schedule",
    cell: ({ row }) => {
      const daysKey = [...row.original.days].sort().join(",");
      const daysLabel = DAYS_LABEL[daysKey] ?? row.original.days.join(",");
      return (
        <span className="text-sm">
          {daysLabel} {row.original.startTime}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    id: "students",
    header: "Students",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.memberships.length}/{row.original.maxStudents}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "isActive",
    header: "Active",
    cell: ({ row }) => (
      <span className={`text-sm ${row.original.isActive ? "text-green-600" : "text-muted-foreground"}`}>
        {row.original.isActive ? "Yes" : "No"}
      </span>
    ),
  },
];

export function GroupTable({ data }: { data: GroupRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="publicId"
      searchPlaceholder="Search by ID..."
    />
  );
}
