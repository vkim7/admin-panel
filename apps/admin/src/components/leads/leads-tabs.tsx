"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { LeadsTable } from "./leads-table";
import { LeadDrawer, type LeadDrawerDetail } from "./lead-drawer";
import { Input } from "@/components/ui/input";
import {
  fetchLeadDetailAction,
  fetchLeadsByTabAction,
} from "@/lib/actions/lead-fetch";
import type {
  LeadStatus,
  LessonPreference,
  SelfAssessedLevel,
  Level,
} from "@eng/database";

export type LeadForTabs = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: Date | null;
  language: string;
  lessonPreference: LessonPreference | null;
  selfAssessedLevel: SelfAssessedLevel | null;
  status: LeadStatus;
  adminNote: string | null;
  preferredDays: number[];
  preferredDaysAny: boolean;
  preferredTimeSlots: string[];
  preferredTimeSlotsAny: boolean;
  testSentAt: Date | null;
  testLevelSent: Level | null;
  testScore: number | null;
  testScoredAt: Date | null;
  nextCallbackAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TabId = "ALL" | "ACTIVE" | "LOST" | "CONVERTED";

const TABS: { id: TabId; label: string; statuses: LeadStatus[] }[] = [
  { id: "ACTIVE", label: "Active", statuses: ["NEW", "CONTACTED"] },
  { id: "LOST", label: "Lost", statuses: ["LOST"] },
  { id: "CONVERTED", label: "Converted", statuses: ["CONVERTED"] },
  { id: "ALL", label: "All", statuses: ["NEW", "CONTACTED", "LOST", "CONVERTED"] },
];

export function LeadsTabs({
  initialActiveLeads,
}: {
  initialActiveLeads: LeadForTabs[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("ACTIVE");
  const [leads, setLeads] = useState<LeadForTabs[]>(initialActiveLeads);
  const [isTabFetching, setIsTabFetching] = useState(false);
  const [search, setSearch] = useState("");
  // Request-id sequence — guards against out-of-order fetch resolves when
  // admin clicks tabs quickly. Each reloadTab() call bumps the counter; only
  // the resolve whose id still matches the latest one is allowed to commit
  // state. The spinner stays on across the storm and clears when the last
  // fetch settles.
  const requestIdRef = useRef(0);

  // Drawer state — client-only. No URL coupling.
  const [drawerDetail, setDrawerDetail] = useState<LeadDrawerDetail | null>(
    null,
  );

  // When the Active tab is the visible one and server-side data changed
  // (post-mutation revalidatePath), keep the client state in sync.
  useEffect(() => {
    if (activeTab === "ACTIVE") {
      setLeads(initialActiveLeads);
    }
  }, [initialActiveLeads, activeTab]);

  const reloadTab = useCallback(
    async (tab: TabId) => {
      const id = ++requestIdRef.current;
      if (tab === "ACTIVE") {
        setLeads(initialActiveLeads);
        setIsTabFetching(false);
        return;
      }
      setIsTabFetching(true);
      const def = TABS.find((t) => t.id === tab)!;
      const data = await fetchLeadsByTabAction(def.statuses);
      // Discard if a newer reloadTab() has been kicked off since this one
      // started. The latest pending request will reset isTabFetching when it
      // settles, so we don't clear it here.
      if (id !== requestIdRef.current) return;
      setLeads(data);
      setIsTabFetching(false);
    },
    [initialActiveLeads],
  );

  async function changeTab(tab: TabId) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    await reloadTab(tab);
  }

  async function openLead(id: string) {
    const data = await fetchLeadDetailAction(id);
    if (data) setDrawerDetail(data);
  }

  function closeDrawer() {
    setDrawerDetail(null);
  }

  /**
   * Called after every in-drawer mutation succeeds. Refreshes both the open
   * drawer detail (client state) and the currently-visible tab. The Active
   * tab is auto-refreshed by Next via revalidatePath; non-Active tabs need an
   * explicit refetch since they live in client state.
   */
  const onDrawerChange = useCallback(async () => {
    if (drawerDetail) {
      const data = await fetchLeadDetailAction(drawerDetail.id);
      setDrawerDetail(data ?? null);
    }
    if (activeTab !== "ACTIVE") {
      await reloadTab(activeTab);
    }
  }, [drawerDetail, activeTab, reloadTab]);

  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return leads;
    // Phone search: strip non-digits on both sides so "+998 90 123 4567"
    // matches "+998901234567". Empty digit-string means user isn't searching
    // for a number — skip the phone branch.
    const queryDigits = query.replace(/\D/g, "");
    return leads.filter((l) => {
      if (`${l.firstName} ${l.lastName}`.toLowerCase().includes(query)) {
        return true;
      }
      if (queryDigits.length > 0 && l.phone.replace(/\D/g, "").includes(queryDigits)) {
        return true;
      }
      if (l.adminNote?.toLowerCase().includes(query)) {
        return true;
      }
      return false;
    });
  }, [leads, query]);

  const activeTabLabel = TABS.find((t) => t.id === activeTab)!.label;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name, phone, or admin note..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex border-b">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              {isActive && isTabFetching && (
                <span className="text-xs text-muted-foreground">…</span>
              )}
            </button>
          );
        })}
      </div>

      <LeadsTable
        data={filtered}
        searchQuery={query}
        tabLabel={activeTabLabel}
        onOpenLead={openLead}
      />

      <LeadDrawer
        detail={drawerDetail}
        onClose={closeDrawer}
        onChange={onDrawerChange}
      />
    </div>
  );
}
