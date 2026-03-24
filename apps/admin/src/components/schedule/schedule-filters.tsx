"use client";

import { useMemo, useState } from "react";
import type { ScheduleTeacherRow } from "@/lib/queries/schedule";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScheduleGrid } from "./schedule-grid";

const LANGUAGE_OPTIONS = [
  { value: "UZ", label: "UZ" },
  { value: "RU", label: "RU" },
] as const;

const LEVEL_OPTIONS = [
  { value: "BEGINNER", label: "BEG" },
  { value: "ELEMENTARY", label: "ELEM" },
  { value: "PRE_INTERMEDIATE", label: "PRE" },
  { value: "INTERMEDIATE", label: "INT" },
  { value: "UPPER_INTERMEDIATE", label: "UPPER" },
  { value: "IELTS", label: "IELTS" },
] as const;

type DayPattern = "mwf" | "tts";
type LanguageFilter = "UZ" | "RU" | null;

interface ScheduleFiltersProps {
  mwf: ScheduleTeacherRow[];
  tts: ScheduleTeacherRow[];
}

function filterTeachers(
  teachers: ScheduleTeacherRow[],
  language: LanguageFilter,
  levels: Set<string>,
): ScheduleTeacherRow[] {
  const hasLanguageFilter = language !== null;
  const hasLevelFilter = levels.size > 0;

  if (!hasLanguageFilter && !hasLevelFilter) return teachers;

  return teachers
    .map((teacher) => {
      // Language filter: filter entire teacher rows
      // UZ selected → show teachers with UZBEK or ANY
      // RU selected → show teachers with RUSSIAN or ANY
      if (hasLanguageFilter) {
        const enum_value = language === "UZ" ? "UZBEK" : "RUSSIAN";
        if (teacher.teachingLanguage !== enum_value && teacher.teachingLanguage !== "ANY") return null;
      }

      // Level filter: hide non-matching cells but track which slots are occupied
      if (!hasLevelFilter) return teacher;

      const filteredSlots: Record<string, typeof teacher.slots[string]> = {};
      const occupiedSlots: string[] = [];
      for (const [slot, cell] of Object.entries(teacher.slots)) {
        if (cell && !levels.has(cell.level)) {
          filteredSlots[slot] = null;
          occupiedSlots.push(slot); // slot is taken, just hidden by filter
        } else {
          filteredSlots[slot] = cell;
        }
      }

      // Remove occupied slots from available so "+" doesn't show for filtered-out groups
      const filteredAvailable = teacher.availableSlots.filter(
        (s) => !occupiedSlots.includes(s),
      );

      // If no cells remain after filtering and no available empty slots, hide the row
      const hasVisibleCells = Object.values(filteredSlots).some((c) => c !== null);
      if (!hasVisibleCells && filteredAvailable.length === 0) return null;

      return { ...teacher, slots: filteredSlots, availableSlots: filteredAvailable };
    })
    .filter((t): t is ScheduleTeacherRow => t !== null);
}

const DAY_PATTERN_OPTIONS: { value: DayPattern; label: string }[] = [
  { value: "mwf", label: "Mon · Wed · Fri" },
  { value: "tts", label: "Tue · Thu · Sat" },
];

export function ScheduleWithFilters({ mwf, tts }: ScheduleFiltersProps) {
  const [dayPattern, setDayPattern] = useState<DayPattern>("mwf");
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageFilter>(null);
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());

  const filteredMwf = useMemo(
    () => filterTeachers(mwf, selectedLanguage, selectedLevels),
    [mwf, selectedLanguage, selectedLevels],
  );
  const filteredTts = useMemo(
    () => filterTeachers(tts, selectedLanguage, selectedLevels),
    [tts, selectedLanguage, selectedLevels],
  );

  function toggleLevel(level: string) {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  const hasFilters = selectedLanguage !== null || selectedLevels.size > 0;

  const activeTeachers = dayPattern === "mwf" ? filteredMwf : filteredTts;
  const activeDays = dayPattern === "mwf" ? "1,3,5" : "2,4,6";

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={selectedLanguage ?? ""}
            onValueChange={(val) => setSelectedLanguage((val as "UZ" | "RU") || null)}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <ToggleGroupItem key={opt.value} value={opt.value}>
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-2">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleLevel(opt.value)}
              className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                selectedLevels.has(opt.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className={`flex items-center gap-4 ${hasFilters ? "visible" : "invisible"}`}>
          <div className="h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => {
              setSelectedLanguage(null);
              setSelectedLevels(new Set());
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Day pattern title + Grid */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          {DAY_PATTERN_OPTIONS.map((opt, i) => {
            const isActive = dayPattern === opt.value;
            return (
              <span key={opt.value} className="flex items-center gap-3">
                {i > 0 && <span className="h-5 w-px bg-border" />}
                <button
                  type="button"
                  onClick={() => setDayPattern(opt.value)}
                  className={`relative transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  }`}
                >
                  {isActive && (
                    <>
                      <span className="absolute -bottom-0.5 left-0 h-[3px] w-full -rotate-1 rounded-sm bg-orange-400/60" />
                      <span className="absolute -bottom-[5px] left-[4px] h-[2px] w-[85%] rotate-[0.5deg] rounded-sm bg-orange-400/40" />
                    </>
                  )}
                  {opt.label}
                </button>
              </span>
            );
          })}
        </h2>
        <ScheduleGrid teachers={activeTeachers} days={activeDays} />
      </div>
    </div>
  );
}
