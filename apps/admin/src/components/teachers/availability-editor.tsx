"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Plus, X } from "lucide-react";
import { setAvailability } from "@/lib/actions/teachers";
import { TIME_SLOTS } from "@/lib/constants";

type PatternKey = "MWF" | "TTS";

const DAY_LABEL: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

const PATTERNS: Record<PatternKey, { label: string; days: readonly number[] }> = {
  MWF: { label: "Mon, Wed, Fri", days: [1, 3, 5] },
  TTS: { label: "Tue, Thu, Sat", days: [2, 4, 6] },
};

const DEFAULT_START = "14:30";
const DEFAULT_END = "22:00";

type Block = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type TimeRange = { startTime: string; endTime: string };

type PatternState = {
  enabled: boolean;
  ranges: TimeRange[];
};

/** Build pattern states from existing DB blocks */
function buildPatternStates(
  blocks: Block[],
): Record<PatternKey, PatternState> {
  const blocksByDay = new Map<number, Block[]>();
  for (const b of blocks) {
    const list = blocksByDay.get(b.dayOfWeek) ?? [];
    list.push(b);
    blocksByDay.set(b.dayOfWeek, list);
  }

  function buildForPattern(days: readonly number[]): PatternState {
    // Collect all ranges from any day in the pattern
    const rangeSet = new Map<string, TimeRange>();
    let hasAny = false;
    for (const day of days) {
      const dayBlocks = blocksByDay.get(day);
      if (dayBlocks) {
        hasAny = true;
        for (const b of dayBlocks) {
          const key = `${b.startTime}-${b.endTime}`;
          if (!rangeSet.has(key)) {
            rangeSet.set(key, { startTime: b.startTime, endTime: b.endTime });
          }
        }
      }
    }

    return {
      enabled: hasAny,
      ranges: hasAny
        ? [...rangeSet.values()].sort((a, b) => a.startTime.localeCompare(b.startTime))
        : [{ startTime: DEFAULT_START, endTime: DEFAULT_END }],
    };
  }

  return {
    MWF: buildForPattern(PATTERNS.MWF.days),
    TTS: buildForPattern(PATTERNS.TTS.days),
  };
}

/** Detect patterns from blocks for display mode */
function detectPatternDisplay(blocks: Block[]): { key: PatternKey; ranges: TimeRange[] }[] {
  const states = buildPatternStates(blocks);
  const result: { key: PatternKey; ranges: TimeRange[] }[] = [];
  for (const key of ["MWF", "TTS"] as PatternKey[]) {
    if (states[key].enabled) {
      result.push({ key, ranges: states[key].ranges });
    }
  }
  return result;
}

export function AvailabilityEditor({
  teacherId,
  blocks,
}: {
  teacherId: string;
  blocks: Block[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showEditor, setShowEditor] = useState(false);
  const [patterns, setPatterns] = useState<Record<PatternKey, PatternState>>(
    () => buildPatternStates(blocks),
  );

  function updatePattern(key: PatternKey, update: Partial<PatternState>) {
    setPatterns((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }));
  }

  function updateRange(key: PatternKey, index: number, update: Partial<TimeRange>) {
    setPatterns((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ranges: prev[key].ranges.map((r, i) =>
          i === index ? { ...r, ...update } : r,
        ),
      },
    }));
  }

  function addRange(key: PatternKey) {
    setPatterns((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ranges: [...prev[key].ranges, { startTime: DEFAULT_START, endTime: DEFAULT_END }],
      },
    }));
  }

  function removeRange(key: PatternKey, index: number) {
    setPatterns((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ranges: prev[key].ranges.filter((_, i) => i !== index),
      },
    }));
  }

  function findOverlap(ranges: TimeRange[]): [number, number] | null {
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const a = ranges[i]!;
        const b = ranges[j]!;
        if (a.startTime < b.endTime && a.endTime > b.startTime) {
          return [i, j];
        }
      }
    }
    return null;
  }

  function handleSave() {
    const allBlocks: { dayOfWeek: number; startTime: string; endTime: string }[] = [];

    for (const key of ["MWF", "TTS"] as PatternKey[]) {
      const pattern = patterns[key];
      if (!pattern.enabled) continue;

      // Check overlaps within this pattern
      const overlap = findOverlap(pattern.ranges);
      if (overlap) {
        const [i, j] = overlap;
        const a = pattern.ranges[i]!;
        const b = pattern.ranges[j]!;
        toast.error(
          `${key}: ${a.startTime}–${a.endTime} overlaps with ${b.startTime}–${b.endTime}`,
        );
        return;
      }

      // Emit blocks for each day in the pattern
      for (const day of PATTERNS[key].days) {
        for (const range of pattern.ranges) {
          allBlocks.push({
            dayOfWeek: day,
            startTime: range.startTime,
            endTime: range.endTime,
          });
        }
      }
    }

    startTransition(async () => {
      const result = await setAvailability(teacherId, allBlocks);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Availability updated");
        setShowEditor(false);
      }
    });
  }

  const endTimeSlots = (startTime: string) =>
    TIME_SLOTS.filter((slot) => slot > startTime);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Availability</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPatterns(buildPatternStates(blocks));
            setShowEditor(!showEditor);
          }}
        >
          {blocks.length > 0 ? (
            <>
              <Pencil className="mr-1 size-4" />
              Edit
            </>
          ) : (
            <>
              <Plus className="mr-1 size-4" />
              Add Blocks
            </>
          )}
        </Button>
      </div>

      {showEditor && (
        <div className="space-y-5 rounded-md border p-4">
          <div className="space-y-4">
            {(["MWF", "TTS"] as PatternKey[]).map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`pattern-${key}`}
                    checked={patterns[key].enabled}
                    onCheckedChange={(checked) =>
                      updatePattern(key, { enabled: !!checked })
                    }
                  />
                  <label
                    htmlFor={`pattern-${key}`}
                    className="text-sm font-medium"
                  >
                    {PATTERNS[key].label}
                  </label>
                </div>

                {patterns[key].enabled && (
                  <div className="ml-7 space-y-2">
                    {patterns[key].ranges.map((range, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Select
                          value={range.startTime}
                          onValueChange={(v) => updateRange(key, i, { startTime: v })}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Start" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_SLOTS.map((slot) => (
                              <SelectItem key={slot} value={slot}>
                                {slot}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <span className="text-muted-foreground text-sm">–</span>

                        <Select
                          value={range.endTime}
                          onValueChange={(v) => updateRange(key, i, { endTime: v })}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="End" />
                          </SelectTrigger>
                          <SelectContent>
                            {endTimeSlots(range.startTime).map((slot) => (
                              <SelectItem key={slot} value={slot}>
                                {slot}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {patterns[key].ranges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRange(key, i)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                        {i === patterns[key].ranges.length - 1 && (
                          <button
                            type="button"
                            onClick={() => addRange(key)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditor(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {blocks.length === 0 && !showEditor ? (
        <p className="text-muted-foreground text-sm">
          No availability blocks set.
        </p>
      ) : (
        blocks.length > 0 &&
        !showEditor && (
          <div className="space-y-2">
            {detectPatternDisplay(blocks).map(({ key, ranges }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-sm font-medium">{PATTERNS[key].label}</span>
                <div className="flex flex-wrap gap-2">
                  {ranges.map((range, i) => (
                    <span
                      key={i}
                      className="bg-muted/50 rounded-md border px-2.5 py-1 text-sm"
                    >
                      {range.startTime}–{range.endTime}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
