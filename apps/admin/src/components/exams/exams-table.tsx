"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { LEVEL_LABEL, DAY_SHORT } from "@/lib/constants";
import type { ExamWithGroup } from "@/lib/queries/exams";

const columns: ColumnDef<ExamWithGroup>[] = [
  {
    accessorFn: (row) => row.group.publicId,
    id: "group",
    header: ({ column }) => (
      <SortableHeader column={column}>Group</SortableHeader>
    ),
    cell: ({ row }) => (
      <Link
        href={`/groups/${row.original.group.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.group.publicId}
      </Link>
    ),
  },
  {
    accessorFn: (row) => row.type,
    id: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant={row.original.type === "MID" ? "secondary" : "default"}>
        {row.original.type === "MID" ? "Mid" : "Final"}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    accessorFn: (row) => row.scheduledDate,
    id: "date",
    header: ({ column }) => (
      <SortableHeader column={column}>Date</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="text-sm">
        {new Date(row.original.scheduledDate).toLocaleDateString("en-GB")}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.group.level,
    id: "level",
    header: "Level",
    cell: ({ row }) => (
      <Badge variant="outline">
        {LEVEL_LABEL[row.original.group.level] ?? row.original.group.level}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    accessorFn: (row) =>
      `${row.group.teacher.firstName} ${row.group.teacher.lastName}`,
    id: "teacher",
    header: ({ column }) => (
      <SortableHeader column={column}>Teacher</SortableHeader>
    ),
    cell: ({ row }) => {
      const teacher = row.original.group.teacher;
      return (
        <Link
          href={`/teachers/${teacher.id}`}
          className="text-sm text-primary hover:underline"
        >
          {teacher.firstName} {teacher.lastName}
        </Link>
      );
    },
  },
  {
    id: "schedule",
    header: "Schedule",
    cell: ({ row }) => {
      const g = row.original.group;
      const days = g.days.map((d: number) => DAY_SHORT[d]).join("/");
      return (
        <span className="text-sm text-muted-foreground">
          {days} at {g.startTime}
        </span>
      );
    },
    enableSorting: false,
  },
];

interface ExamsTableProps {
  data: ExamWithGroup[];
}

export function ExamsTable({ data }: ExamsTableProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? data.filter((e) => {
        const q = search.toLowerCase();
        return e.group.publicId.toLowerCase().includes(q);
      })
    : data;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by group..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <DataTable columns={columns} data={filtered} pageSize={30} />
    </div>
  );
}
