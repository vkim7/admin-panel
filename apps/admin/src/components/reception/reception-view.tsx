"use client";

import { useState } from "react";
import { ReceptionTable } from "./reception-table";
import { FirstLessons } from "./first-lessons";
import { SecondLessons } from "./second-lessons";
import type { FirstLessonRow, SecondLessonRow } from "@/lib/queries/reception";
import type { LostReason } from "@/lib/queries/students";
import type { TransferGroup } from "@/lib/queries/transfers";
import type { GroupOption } from "./assign-dialog";

type ReceptionStudent = Parameters<typeof ReceptionTable>[0]["data"][number];

type ViewTab = "reception" | "first" | "second";

interface ReceptionViewProps {
  students: ReceptionStudent[];
  groups: GroupOption[];
  firstLessons: FirstLessonRow[];
  secondLessons: SecondLessonRow[];
  lostReasons: LostReason[];
  transferGroups: TransferGroup[];
}

export function ReceptionView({
  students,
  groups,
  firstLessons,
  secondLessons,
  lostReasons,
  transferGroups,
}: ReceptionViewProps) {
  const [view, setView] = useState<ViewTab>("reception");

  const tabs: { value: ViewTab; label: string; count: number }[] = [
    { value: "reception", label: "Reception", count: students.length },
    { value: "first", label: "First Lessons", count: firstLessons.length },
    { value: "second", label: "Second Lessons", count: secondLessons.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setView(tab.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              view === tab.value
                ? "border-primary bg-primary/5 text-primary"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {view === "reception" && <ReceptionTable data={students} groups={groups} />}
      {view === "first" && (
        <FirstLessons data={firstLessons} lostReasons={lostReasons} transferGroups={transferGroups} />
      )}
      {view === "second" && <SecondLessons data={secondLessons} />}
    </div>
  );
}
