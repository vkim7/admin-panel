"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { MONTH_NAMES } from "@/lib/constants";

type HolidayRow = {
  id: string;
  date: Date;
  name: string;
  createdAt: Date;
};

type HolidayGroup = {
  ids: string[];
  startDate: Date;
  endDate: Date;
  days: number;
  names: string[];
  label: string;
};

/** Format as "Jan 1" */
function formatDate(date: Date): string {
  const d = new Date(date);
  return `${MONTH_NAMES[d.getUTCMonth() + 1]} ${d.getUTCDate()}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Group consecutive dates into ranges. Two dates are consecutive if they differ by exactly 1 day. */
function groupHolidays(holidays: HolidayRow[]): HolidayGroup[] {
  if (holidays.length === 0) return [];

  const sorted = [...holidays].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const groups: HolidayGroup[] = [];
  let current: HolidayRow[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!.date).getTime();
    const curr = new Date(sorted[i]!.date).getTime();
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      current.push(sorted[i]!);
    } else {
      groups.push(buildGroup(current));
      current = [sorted[i]!];
    }
  }
  groups.push(buildGroup(current));

  return groups;
}

function buildGroup(holidays: HolidayRow[]): HolidayGroup {
  const ids = holidays.map((h) => h.id);
  const startDate = holidays[0]!.date;
  const endDate = holidays[holidays.length - 1]!.date;
  const names = holidays.map((h) => h.name);

  // Pick a representative label: filter out names ending in "Holiday" or "Eve"
  // to find the "primary" name, fall back to first name
  const primaryNames = names.filter(
    (n) => !n.endsWith("Holiday") && !n.endsWith("Eve"),
  );
  const label = primaryNames[0] ?? names[0]!;

  return { ids, startDate, endDate, days: holidays.length, names, label };
}

const columns: ColumnDef<HolidayGroup>[] = [
  {
    accessorKey: "label",
    header: ({ column }) => (
      <SortableHeader column={column}>Name</SortableHeader>
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => (
      <SortableHeader column={column}>Date</SortableHeader>
    ),
    cell: ({ row }) => {
      const { startDate, endDate, days } = row.original;

      if (days === 1) {
        return formatDate(startDate);
      }

      return (
        <span className="flex items-center gap-2">
          {formatDate(startDate)} – {formatDate(endDate)}
          <Badge variant="secondary" className="text-xs">
            {days} days
          </Badge>
        </span>
      );
    },
    sortingFn: "datetime",
  },
  {
    id: "days",
    header: "Days",
    cell: ({ row }) => {
      const { startDate, endDate, days } = row.original;
      const startDow = DAY_NAMES[new Date(startDate).getUTCDay()];

      if (days === 1) {
        return <span className="text-muted-foreground">{startDow}</span>;
      }

      const endDow = DAY_NAMES[new Date(endDate).getUTCDay()];
      return (
        <span className="text-muted-foreground">
          {startDow}–{endDow}
        </span>
      );
    },
    enableSorting: false,
  },
];

export function HolidaysTable({ data }: { data: HolidayRow[] }) {
  const groups = useMemo(() => groupHolidays(data), [data]);

  return (
    <DataTable
      columns={columns}
      data={groups}
      searchKey="label"
      searchPlaceholder="Search holidays..."
      initialSorting={[{ id: "startDate", desc: false }]}
    />
  );
}
