"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Plus, X } from "lucide-react";
import { setAvailability } from "@/lib/actions/teachers";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
] as const;

const DEFAULT_START = "14:00";
const DEFAULT_END = "22:00";

type Block = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type TimeRange = {
  startTime: string;
  endTime: string;
};

type DayState = {
  dayOfWeek: number;
  label: string;
  enabled: boolean;
  ranges: TimeRange[];
};

function buildDayStates(existingBlocks: Block[]): DayState[] {
  const blocksByDay = new Map<number, Block[]>();
  for (const b of existingBlocks) {
    const list = blocksByDay.get(b.dayOfWeek) ?? [];
    list.push(b);
    blocksByDay.set(b.dayOfWeek, list);
  }

  return DAYS.map((day) => {
    const existing = blocksByDay.get(day.value);
    return {
      dayOfWeek: day.value,
      label: day.label,
      enabled: !!existing,
      ranges: existing?.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
      })) ?? [{ startTime: DEFAULT_START, endTime: DEFAULT_END }],
    };
  });
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
  const [dayStates, setDayStates] = useState<DayState[]>(() =>
    buildDayStates(blocks),
  );

  function updateDay(
    dayOfWeek: number,
    update: Partial<Pick<DayState, "enabled" | "ranges">>,
  ) {
    setDayStates((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...update } : d)),
    );
  }

  function updateRange(
    dayOfWeek: number,
    rangeIndex: number,
    update: Partial<TimeRange>,
  ) {
    setDayStates((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const ranges = d.ranges.map((r, i) =>
          i === rangeIndex ? { ...r, ...update } : r,
        );
        return { ...d, ranges };
      }),
    );
  }

  function addRange(dayOfWeek: number) {
    setDayStates((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        return {
          ...d,
          ranges: [
            ...d.ranges,
            { startTime: DEFAULT_START, endTime: DEFAULT_END },
          ],
        };
      }),
    );
  }

  function removeRange(dayOfWeek: number, rangeIndex: number) {
    setDayStates((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        return {
          ...d,
          ranges: d.ranges.filter((_, i) => i !== rangeIndex),
        };
      }),
    );
  }

  function findOverlap(day: DayState): [number, number] | null {
    for (let i = 0; i < day.ranges.length; i++) {
      for (let j = i + 1; j < day.ranges.length; j++) {
        const a = day.ranges[i]!;
        const b = day.ranges[j]!;
        if (a.startTime < b.endTime && a.endTime > b.startTime) {
          return [i, j];
        }
      }
    }
    return null;
  }

  function handleSave() {
    const enabledDays = dayStates.filter((d) => d.enabled);

    for (const day of enabledDays) {
      const overlap = findOverlap(day);
      if (overlap) {
        const [i, j] = overlap;
        const a = day.ranges[i]!;
        const b = day.ranges[j]!;
        toast.error(
          `${day.label}: ${a.startTime}–${a.endTime} overlaps with ${b.startTime}–${b.endTime}`,
        );
        return;
      }
    }

    const data = enabledDays.flatMap((d) =>
      d.ranges.map((r) => ({
        dayOfWeek: d.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
    );

    startTransition(async () => {
      const result = await setAvailability(teacherId, data);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Availability updated");
        setShowEditor(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Availability</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDayStates(buildDayStates(blocks));
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
          <div className="space-y-2">
            {dayStates.map((day) => (
              <div key={day.dayOfWeek} className="flex gap-3">
                <div className="flex items-start gap-3 pt-2">
                  <Checkbox
                    id={`day-${day.dayOfWeek}`}
                    checked={day.enabled}
                    onCheckedChange={(checked) =>
                      updateDay(day.dayOfWeek, { enabled: !!checked })
                    }
                  />
                  <label
                    htmlFor={`day-${day.dayOfWeek}`}
                    className="w-24 text-sm font-medium"
                  >
                    {day.label}
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  {day.ranges.map((range, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="time"
                        step={900}
                        value={range.startTime}
                        onChange={(e) =>
                          updateRange(day.dayOfWeek, i, {
                            startTime: e.target.value,
                          })
                        }
                        disabled={!day.enabled}
                        className="w-[110px]"
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="time"
                        step={900}
                        value={range.endTime}
                        onChange={(e) =>
                          updateRange(day.dayOfWeek, i, {
                            endTime: e.target.value,
                          })
                        }
                        disabled={!day.enabled}
                        className="w-[110px]"
                      />
                      {day.ranges.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRange(day.dayOfWeek, i)}
                          disabled={!day.enabled}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                      {i === day.ranges.length - 1 && (
                        <button
                          type="button"
                          onClick={() => addRange(day.dayOfWeek)}
                          disabled={!day.enabled}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          <Plus className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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
            {DAYS.map((day) => {
              const dayBlocks = blocks.filter((b) => b.dayOfWeek === day.value);
              if (dayBlocks.length === 0) return null;
              return (
                <div key={day.value} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-medium">{day.label}</span>
                  <div className="flex flex-wrap gap-2">
                    {dayBlocks.map((block) => (
                      <span
                        key={block.id}
                        className="bg-muted/50 rounded-md border px-2.5 py-1 text-sm"
                      >
                        {block.startTime}–{block.endTime}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
