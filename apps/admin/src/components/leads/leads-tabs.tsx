"use client";

import { useState, useMemo } from "react";
import { LeadsTable } from "./leads-table";
import { Input } from "@/components/ui/input";
import { getStaleInfo } from "@/lib/helpers/lead-staleness";
import type { LeadStatus, LessonPreference, SelfAssessedLevel } from "@eng/database";

export type LeadForTabs = {
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
  updatedAt: Date;
};

export type TabId = "NEW" | "CONTACTED" | "TRIAL_SCHEDULED" | "CLOSED";

const TABS: { id: TabId; label: string; statuses: LeadStatus[] }[] = [
  { id: "NEW", label: "New", statuses: ["NEW"] },
  { id: "CONTACTED", label: "Contacted", statuses: ["CONTACTED"] },
  { id: "TRIAL_SCHEDULED", label: "Trial scheduled", statuses: ["TRIAL_SCHEDULED"] },
  { id: "CLOSED", label: "Closed", statuses: ["CONVERTED", "LOST"] },
];

function staleSeverity(color: "red" | "amber" | null | undefined): number {
  if (color === "red") return 2;
  if (color === "amber") return 1;
  return 0;
}

export function LeadsTabs({ leads }: { leads: LeadForTabs[] }) {
  const [activeTab, setActiveTab] = useState<TabId>("NEW");
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return leads;
    return leads.filter(
      (l) =>
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(query) ||
        l.phone.includes(query),
    );
  }, [leads, query]);

  const tabMeta = useMemo(
    () =>
      TABS.map((tab) => {
        const tabLeads = filtered.filter((l) =>
          tab.statuses.includes(l.status),
        );
        const staleInfos = tabLeads
          .map((l) => getStaleInfo(l))
          .filter((s): s is NonNullable<typeof s> => s !== null);
        const staleCount = staleInfos.length;
        const staleColor = staleInfos.reduce<"red" | "amber" | null>(
          (acc, s) =>
            staleSeverity(s.color) > staleSeverity(acc) ? s.color : acc,
          null,
        );
        return { id: tab.id, total: tabLeads.length, staleCount, staleColor };
      }),
    [filtered],
  );

  const activeLeads = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab)!;
    const tabLeads = filtered.filter((l) =>
      tab.statuses.includes(l.status),
    );

    if (activeTab === "CLOSED") {
      return [...tabLeads].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return [...tabLeads].sort((a, b) => {
      const diff =
        staleSeverity(getStaleInfo(b)?.color) -
        staleSeverity(getStaleInfo(a)?.color);
      if (diff !== 0) return diff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [filtered, activeTab]);

  const activeTabLabel = TABS.find((t) => t.id === activeTab)!.label;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search leads..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex border-b">
        {TABS.map((tab) => {
          const meta = tabMeta.find((m) => m.id === tab.id)!;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span className="tabular-nums text-xs text-muted-foreground">
                {meta.total}
              </span>
              {meta.staleCount > 0 && meta.staleColor && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    meta.staleColor === "red"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      meta.staleColor === "red" ? "bg-red-500" : "bg-amber-400"
                    }`}
                  />
                  {meta.staleCount} stale
                </span>
              )}
            </button>
          );
        })}
      </div>

      <LeadsTable
        data={activeLeads}
        activeTab={activeTab}
        searchQuery={query}
        tabLabel={activeTabLabel}
      />
    </div>
  );
}
