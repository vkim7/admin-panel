"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

type TeacherRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  levels: string[];
  canTeachUzbek: boolean;
  canTeachRussian: boolean;
  canTeachEnglishOnly: boolean;
  groups: { id: string; type: string }[];
};

const LEVEL_SHORT: Record<string, string> = {
  BEGINNER: "Beg",
  ELEMENTARY: "Elem",
  PRE_INTERMEDIATE: "Pre-Int",
  INTERMEDIATE: "Int",
  UPPER_INTERMEDIATE: "Upper-Int",
  IELTS: "IELTS",
};

const columns: ColumnDef<TeacherRow>[] = [
  {
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    id: "name",
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => (
      <Link
        href={`/teachers/${row.original.id}`}
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
    accessorKey: "levels",
    header: "Levels",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.levels.map((l) => (
          <Badge key={l} variant="secondary" className="text-xs">
            {LEVEL_SHORT[l] ?? l}
          </Badge>
        ))}
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "languages",
    header: "Languages",
    cell: ({ row }) => {
      const langs: string[] = [];
      if (row.original.canTeachUzbek) langs.push("UZ");
      if (row.original.canTeachRussian) langs.push("RU");
      if (row.original.canTeachEnglishOnly) langs.push("EN-only");
      return <span className="text-sm text-muted-foreground">{langs.join(", ")}</span>;
    },
    enableSorting: false,
  },
  {
    id: "groups",
    header: "Groups",
    cell: ({ row }) => {
      const groupCount = row.original.groups.filter((g) => g.type === "GROUP").length;
      const indCount = row.original.groups.filter((g) => g.type === "INDIVIDUAL").length;
      const parts: string[] = [];
      if (groupCount > 0) parts.push(`${groupCount} group`);
      if (indCount > 0) parts.push(`${indCount} ind`);
      return <span className="text-sm">{parts.join(", ") || "—"}</span>;
    },
    enableSorting: false,
  },
];

export function TeacherTable({ data }: { data: TeacherRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search teachers..."
    />
  );
}
