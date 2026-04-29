"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { LeadStatusSelect } from "./lead-status-select";
import { LeadNoteEditor } from "./lead-note-editor";
import type {
  LeadStatus,
  LessonPreference,
  SelfAssessedLevel,
} from "@eng/database";

type LeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: Date | null;
  note: string | null;
  language: string;
  lessonPreference: LessonPreference | null;
  selfAssessedLevel: SelfAssessedLevel | null;
  status: LeadStatus;
  adminNote: string | null;
  createdAt: Date;
};

const LESSON_PREF_LABELS: Record<string, string> = {
  GROUP: "Group",
  INDIVIDUAL: "Individual",
  EITHER: "Either",
};

const LEVEL_LABELS: Record<string, string> = {
  COMPLETE_BEGINNER: "Beginner",
  KNOW_A_LITTLE: "Some English",
  CAN_HOLD_CONVERSATION: "Conversational",
};

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

const columns: ColumnDef<LeadRow>[] = [
  {
    id: "name",
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    header: ({ column }) => (
      <SortableHeader column={column}>Name</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.firstName} {row.original.lastName}
      </span>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => (
      <a
        href={`tel:${row.original.phone}`}
        className="text-primary hover:underline"
      >
        {row.original.phone}
      </a>
    ),
  },
  {
    accessorKey: "dateOfBirth",
    header: "DOB",
    cell: ({ row }) =>
      row.original.dateOfBirth
        ? formatDate(row.original.dateOfBirth)
        : "—",
  },
  {
    accessorKey: "language",
    header: "Lang",
    cell: ({ row }) => (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
          row.original.language === "uz"
            ? "bg-blue-100 text-blue-800"
            : "bg-purple-100 text-purple-800"
        }`}
      >
        {row.original.language.toUpperCase()}
      </span>
    ),
    filterFn: "equals",
  },
  {
    accessorKey: "lessonPreference",
    header: "Lesson Type",
    cell: ({ row }) =>
      row.original.lessonPreference
        ? LESSON_PREF_LABELS[row.original.lessonPreference] ?? row.original.lessonPreference
        : "—",
  },
  {
    accessorKey: "selfAssessedLevel",
    header: "Level",
    cell: ({ row }) =>
      row.original.selfAssessedLevel
        ? LEVEL_LABELS[row.original.selfAssessedLevel] ?? row.original.selfAssessedLevel
        : "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <LeadStatusSelect
        leadId={row.original.id}
        currentStatus={row.original.status}
      />
    ),
    filterFn: "equals",
  },
  {
    accessorKey: "note",
    header: "Note",
    cell: ({ row }) =>
      row.original.note ? (
        <span
          className="max-w-[150px] truncate block text-muted-foreground text-xs"
          title={row.original.note}
        >
          {row.original.note}
        </span>
      ) : null,
    enableSorting: false,
  },
  {
    accessorKey: "adminNote",
    header: "Admin Note",
    cell: ({ row }) => (
      <LeadNoteEditor
        leadId={row.original.id}
        currentNote={row.original.adminNote}
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <SortableHeader column={column}>Created</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs" title={formatDate(row.original.createdAt)}>
        {formatRelative(row.original.createdAt)}
      </span>
    ),
    sortingFn: "datetime",
  },
  {
    id: "convert",
    header: "",
    cell: ({ row }) => {
      const isConverted = row.original.status === "CONVERTED";
      if (isConverted) {
        return (
          <Button size="sm" variant="outline" disabled>
            Converted
          </Button>
        );
      }
      return (
        <Button asChild size="sm">
          <Link
            href={`/students/new?leadId=${row.original.id}&returnTo=/reception`}
          >
            Convert
          </Link>
        </Button>
      );
    },
    enableSorting: false,
  },
];

export function LeadsTable({ data }: { data: LeadRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search leads..."
      initialSorting={[{ id: "createdAt", desc: true }]}
    />
  );
}
