"use client";

import { useState, useMemo } from "react";
import { ReceptionTable } from "./reception-table";
import { FirstLessons } from "./first-lessons";
import { SecondLessons } from "./second-lessons";
import { ScheduledTab } from "./scheduled-tab";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  FirstLessonRow,
  ScheduledAssignmentRow,
  SecondLessonRow,
  ReceptionStudentRow,
} from "@/lib/queries/reception";
import type { LostReason } from "@/lib/queries/students";
import type { TransferGroup } from "@/lib/queries/transfers";
import type { GroupOption } from "./assign-dialog";

type ViewTab = "reception" | "scheduled" | "first" | "second";
type TypeFilter = "GROUP" | "INDIVIDUAL" | null;
type LangFilter = "UZBEK" | "RUSSIAN" | null;

// Override the toggle's default "on" styling (subtle accent gray) with the
// primary color so selection is visible at a glance.
const SELECTED_TOGGLE_CLASS =
  "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary";

/**
 * Substring match on a name + one or more phone fields. Phone match strips
 * non-digits on both sides so "+998 90 ..." matches "+998901230000". Empty
 * `q` (the lowercase trimmed query) means "no filter — pass everything."
 *
 * Top-level helper rather than a closure so the calling memo's deps can be
 * exhaustive without `// eslint-disable react-hooks/exhaustive-deps`.
 */
function matchesSearch(
  q: string,
  queryDigits: string,
  haystack: string,
  ...phones: (string | null | undefined)[]
): boolean {
  if (!q) return true;
  if (haystack.toLowerCase().includes(q)) return true;
  if (queryDigits.length === 0) return false;
  for (const p of phones) {
    if (p && p.replace(/\D/g, "").includes(queryDigits)) return true;
  }
  return false;
}

interface ReceptionViewProps {
  students: ReceptionStudentRow[];
  groups: GroupOption[];
  firstLessons: FirstLessonRow[];
  secondLessons: SecondLessonRow[];
  lostReasons: LostReason[];
  transferGroups: TransferGroup[];
  scheduledAssignments: ScheduledAssignmentRow[];
}

export function ReceptionView({
  students,
  groups,
  firstLessons,
  secondLessons,
  lostReasons,
  transferGroups,
  scheduledAssignments,
}: ReceptionViewProps) {
  const [view, setView] = useState<ViewTab>("reception");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(null);
  const [langFilter, setLangFilter] = useState<LangFilter>(null);

  const tabs: { value: ViewTab; label: string; count: number }[] = [
    { value: "reception", label: "Reception", count: students.length },
    { value: "scheduled", label: "Scheduled", count: scheduledAssignments.length },
    { value: "first", label: "First Lessons", count: firstLessons.length },
    { value: "second", label: "Second Lessons", count: secondLessons.length },
  ];

  const q = search.trim().toLowerCase();
  const queryDigits = q.replace(/\D/g, "");

  // Reception filter: Type + Lang (semantic — EITHER/ANY match both) +
  // search across name, CRM code, student phone, parent phone.
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (typeFilter !== null) {
        const matches =
          s.preferredLessonType === typeFilter ||
          s.preferredLessonType === "EITHER";
        if (!matches) return false;
      }
      if (langFilter !== null) {
        const matches =
          s.preferredLanguage === langFilter || s.preferredLanguage === "ANY";
        if (!matches) return false;
      }
      // CRM is concatenated into the haystack so admin can look up by code
      // even though we don't render the CRM column anymore.
      const haystack = `${s.firstName} ${s.lastName} ${s.crmCode}`;
      return matchesSearch(
        q,
        queryDigits,
        haystack,
        s.phone,
        s.family?.parentPhone,
      );
    });
  }, [students, typeFilter, langFilter, q, queryDigits]);

  const filteredScheduled = useMemo(
    () =>
      scheduledAssignments.filter((r) =>
        matchesSearch(
          q,
          queryDigits,
          `${r.firstName} ${r.lastName} ${r.crmCode}`,
          r.phone,
        ),
      ),
    [scheduledAssignments, q, queryDigits],
  );

  const filteredFirstLessons = useMemo(
    () =>
      firstLessons.filter((r) =>
        matchesSearch(q, queryDigits, `${r.studentName} ${r.crmCode}`, r.phone),
      ),
    [firstLessons, q, queryDigits],
  );

  const filteredSecondLessons = useMemo(
    () =>
      secondLessons.filter((r) =>
        matchesSearch(q, queryDigits, `${r.studentName} ${r.crmCode}`, r.phone),
      ),
    [secondLessons, q, queryDigits],
  );

  return (
    <div className="space-y-4">
      {/* Search is on every tab. Type/Lang filters apply to Reception only —
          the other tabs' row shapes don't carry those fields. */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          placeholder="Search by name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[240px]"
        />
        {view === "reception" && (
          <>
            <div className="h-5 w-px bg-border" />
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={typeFilter ?? ""}
              onValueChange={(v) => setTypeFilter((v as TypeFilter) || null)}
            >
              <ToggleGroupItem value="GROUP" className={SELECTED_TOGGLE_CLASS}>
                Group
              </ToggleGroupItem>
              <ToggleGroupItem
                value="INDIVIDUAL"
                className={SELECTED_TOGGLE_CLASS}
              >
                Individual
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="h-5 w-px bg-border" />
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={langFilter ?? ""}
              onValueChange={(v) => setLangFilter((v as LangFilter) || null)}
            >
              <ToggleGroupItem value="UZBEK" className={SELECTED_TOGGLE_CLASS}>
                UZ
              </ToggleGroupItem>
              <ToggleGroupItem
                value="RUSSIAN"
                className={SELECTED_TOGGLE_CLASS}
              >
                RU
              </ToggleGroupItem>
            </ToggleGroup>
          </>
        )}
      </div>

      {/* Tabs — underline style matching /leads */}
      <div className="flex border-b">
        {tabs.map((tab) => {
          const isActive = view === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setView(tab.value)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span className="tabular-nums text-xs text-muted-foreground">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {view === "reception" && (
        <ReceptionTable
          data={filteredStudents}
          groups={groups}
          lostReasons={lostReasons}
        />
      )}
      {view === "scheduled" && <ScheduledTab data={filteredScheduled} />}
      {view === "first" && (
        <FirstLessons
          data={filteredFirstLessons}
          lostReasons={lostReasons}
          transferGroups={transferGroups}
        />
      )}
      {view === "second" && <SecondLessons data={filteredSecondLessons} />}
    </div>
  );
}
