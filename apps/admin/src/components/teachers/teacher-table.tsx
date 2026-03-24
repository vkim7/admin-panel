"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

type TeacherRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  isActive: boolean;
  levels: string[];
  teachingLanguage: string;
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

type FilterValue = "active" | "deactivated" | "all";

const columns: ColumnDef<TeacherRow>[] = [
  {
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    id: "name",
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => (
      <Link
        href={`/teachers/${row.original.id}`}
        className={`font-medium hover:underline ${row.original.isActive ? "text-primary" : "text-muted-foreground"}`}
      >
        {row.original.firstName} {row.original.lastName}
        {!row.original.isActive && (
          <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
            Deactivated
          </Badge>
        )}
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
    header: "Language",
    cell: ({ row }) => {
      const lang = row.original.teachingLanguage === "ANY" ? "Both" : row.original.teachingLanguage === "UZBEK" ? "UZ" : "RU";
      return <span className="text-sm text-muted-foreground">{lang}</span>;
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
  const [filter, setFilter] = useState<FilterValue>("active");

  const filtered = data.filter((t) => {
    if (filter === "active") return t.isActive;
    if (filter === "deactivated") return !t.isActive;
    return true;
  });

  const filters: { value: FilterValue; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "deactivated", label: "Deactivated" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        searchKey="name"
        searchPlaceholder="Search by name..."
      />
    </div>
  );
}
