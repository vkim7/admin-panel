"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import {
  getUrgencyInfo,
  tierRank,
  type UrgencyInfo,
} from "@/lib/helpers/lead-staleness";
import { LeadUrgencyChip } from "./lead-urgency-chip";
import { LESSON_LABEL } from "@/lib/constants";
import type { LeadStatus } from "@eng/database";
import type { LeadForTabs as LeadRow } from "./leads-tabs";

// Status-first sort: NEW leads always sort above CONTACTED, regardless of
// urgency tier on the CONTACTED side. Within each status the urgency tier
// breaks the tie (red stale-NEW above fresh-NEW, etc.).
const STATUS_PRIORITY: Record<LeadStatus, number> = {
  NEW: 0,
  CONTACTED: 1,
  CONVERTED: 2,
  LOST: 3,
};

type RowWithUrgency = LeadRow & { _urgency: UrgencyInfo };

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
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Tashkent",
  });
}

function buildColumns(): ColumnDef<RowWithUrgency>[] {
  return [
    {
      id: "urgency",
      header: "",
      enableSorting: false,
      meta: { cellClassName: "pr-10", headerClassName: "pr-10" },
      cell: ({ row }) => <LeadUrgencyChip info={row.original._urgency} />,
    },
    {
      id: "name",
      header: "Name",
      meta: { cellClassName: "pr-10", headerClassName: "pr-10" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium leading-tight">
            {row.original.firstName} {row.original.lastName}
          </span>
          <span className="text-xs text-muted-foreground leading-tight">
            {formatRelative(row.original.createdAt)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "language",
      header: "Lang · Type · Level",
      meta: { cellClassName: "pr-10", headerClassName: "pr-10" },
      cell: ({ row }) => {
        const lang = row.original.language.toUpperCase();
        const lesson = row.original.lessonPreference
          ? LESSON_LABEL[row.original.lessonPreference]
          : null;
        const level =
          row.original.selfAssessedLevel === "COMPLETE_BEGINNER"
            ? "Beginner"
            : row.original.selfAssessedLevel === "CONTINUING"
              ? "Continuing"
              : null;
        return (
          <span className="text-muted-foreground text-xs">
            <span className="uppercase">{lang}</span>
            {lesson && ` · ${lesson}`}
            {level && ` · ${level}`}
          </span>
        );
      },
    },
    {
      accessorKey: "adminNote",
      header: "Note",
      enableSorting: false,
      meta: {
        cellClassName: "w-full text-left align-top",
        headerClassName: "w-full text-left",
      },
      cell: ({ row }) =>
        row.original.adminNote ? (
          // `whitespace-pre-wrap` preserves newlines from the textarea; line-clamp
          // caps height so rows stay scannable (full note is visible in the drawer).
          <span className="block text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 max-w-md">
            {row.original.adminNote}
          </span>
        ) : null,
    },
  ];
}

export function LeadsTable({
  data,
  searchQuery,
  tabLabel,
  onOpenLead,
}: {
  data: LeadRow[];
  searchQuery: string;
  tabLabel: string;
  onOpenLead: (id: string) => void;
}) {
  const columns = useMemo(() => buildColumns(), []);

  // Compute urgency once per render, sort by status then tier.
  const enriched = useMemo<RowWithUrgency[]>(() => {
    const withInfo = data.map((lead) => ({
      ...lead,
      _urgency: getUrgencyInfo(lead),
    }));

    withInfo.sort((a, b) => {
      // 1) Status priority: NEW above CONTACTED above CONVERTED above LOST.
      const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (statusDiff !== 0) return statusDiff;

      // 2) Urgency tier within status: red above green above blue above amber above idle.
      const tierDiff = tierRank(b._urgency.tier) - tierRank(a._urgency.tier);
      if (tierDiff !== 0) return tierDiff;

      // 3) Earlier callbacks first, then newest leads.
      const aCb = a.nextCallbackAt
        ? new Date(a.nextCallbackAt).getTime()
        : Infinity;
      const bCb = b.nextCallbackAt
        ? new Date(b.nextCallbackAt).getTime()
        : Infinity;
      if (aCb !== bCb) return aCb - bCb;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return withInfo;
  }, [data]);

  if (enriched.length === 0) {
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
    <DataTable
      columns={columns}
      data={enriched}
      onRowClick={(row) => onOpenLead(row.id)}
    />
  );
}
