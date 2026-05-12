"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { LeadStatusSelect } from "./lead-status-select";
import { LeadNoteEditor } from "./lead-note-editor";
import { getStaleInfo } from "@/lib/helpers/lead-staleness";
import type { LeadStatus } from "@eng/database";
import type { TabId, LeadForTabs as LeadRow } from "./leads-tabs";

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

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  LOST: "Lost",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-amber-100 text-amber-700",
  CONVERTED: "bg-green-100 text-green-700",
  LOST: "bg-slate-100 text-slate-600",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
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

function buildColumns(activeTab: TabId): ColumnDef<LeadRow>[] {
  const cols: ColumnDef<LeadRow>[] = [
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
    },
    {
      accessorKey: "lessonPreference",
      header: "Lesson Type",
      cell: ({ row }) =>
        row.original.lessonPreference
          ? (LESSON_PREF_LABELS[row.original.lessonPreference] ??
            row.original.lessonPreference)
          : "—",
    },
    {
      accessorKey: "selfAssessedLevel",
      header: "Level",
      cell: ({ row }) =>
        row.original.selfAssessedLevel
          ? (LEVEL_LABELS[row.original.selfAssessedLevel] ??
            row.original.selfAssessedLevel)
          : "—",
    },
    // Status: static badge on Converted (locked — set only by createStudent);
    // editable dropdown everywhere else, including Lost (so mistaken LOST is recoverable).
    activeTab === "CONVERTED"
      ? {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[row.original.status]}`}
            >
              {STATUS_LABELS[row.original.status]}
            </span>
          ),
        }
      : {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => (
            <LeadStatusSelect
              leadId={row.original.id}
              currentStatus={row.original.status}
            />
          ),
        },
    {
      accessorKey: "adminNote",
      header: "Admin Note",
      enableSorting: false,
      cell: ({ row }) => (
        <LeadNoteEditor
          leadId={row.original.id}
          currentNote={row.original.adminNote}
        />
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortableHeader column={column}>Created</SortableHeader>
      ),
      sortingFn: "datetime",
      cell: ({ row }) => {
        const stale = getStaleInfo(row.original);
        return (
          <span className="flex items-center gap-1.5">
            {stale && (
              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <span
                    className={`inline-block w-2 h-2 rounded-full shrink-0 cursor-default ${
                      stale.color === "red" ? "bg-red-500" : "bg-amber-400"
                    }`}
                  />
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content
                    side="top"
                    sideOffset={4}
                    className="z-50 rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
                  >
                    {stale.reason}
                    <TooltipPrimitive.Arrow className="fill-popover" />
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>
            )}
            <span
              className="text-muted-foreground text-xs"
              title={formatDate(row.original.createdAt)}
            >
              {formatRelative(row.original.createdAt)}
            </span>
          </span>
        );
      },
    },
  ];

  if (activeTab === "NEW" || activeTab === "CONTACTED") {
    cols.push({
      id: "convert",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Button asChild size="sm">
          <Link
            href={`/students/new?leadId=${row.original.id}&returnTo=/leads`}
          >
            Convert
          </Link>
        </Button>
      ),
    });
  }

  return cols;
}

export function LeadsTable({
  data,
  activeTab,
  searchQuery,
  tabLabel,
}: {
  data: LeadRow[];
  activeTab: TabId;
  searchQuery: string;
  tabLabel: string;
}) {
  const columns = useMemo(() => buildColumns(activeTab), [activeTab]);

  if (data.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
          {searchQuery
            ? `No matches for "${searchQuery}" in ${tabLabel}.`
            : `No leads in ${tabLabel}.`}
        </div>
      </div>
    );
  }

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <DataTable columns={columns} data={data} />
    </TooltipPrimitive.Provider>
  );
}
