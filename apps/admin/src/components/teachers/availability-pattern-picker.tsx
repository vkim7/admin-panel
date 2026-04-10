"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from "lucide-react";
import { TIME_SLOTS } from "@/lib/constants";
import {
  type PatternKey,
  type PatternState,
  type TimeRange,
  PATTERNS,
  DEFAULT_START,
  DEFAULT_END,
} from "@/lib/availability-patterns";

interface AvailabilityPatternPickerProps {
  patterns: Record<PatternKey, PatternState>;
  onPatternsChange: (patterns: Record<PatternKey, PatternState>) => void;
}

export function AvailabilityPatternPicker({
  patterns,
  onPatternsChange,
}: AvailabilityPatternPickerProps) {
  function updatePattern(key: PatternKey, update: Partial<PatternState>) {
    onPatternsChange({ ...patterns, [key]: { ...patterns[key], ...update } });
  }

  function updateRange(key: PatternKey, index: number, update: Partial<TimeRange>) {
    onPatternsChange({
      ...patterns,
      [key]: {
        ...patterns[key],
        ranges: patterns[key].ranges.map((r, i) =>
          i === index ? { ...r, ...update } : r,
        ),
      },
    });
  }

  function addRange(key: PatternKey) {
    onPatternsChange({
      ...patterns,
      [key]: {
        ...patterns[key],
        ranges: [...patterns[key].ranges, { startTime: DEFAULT_START, endTime: DEFAULT_END }],
      },
    });
  }

  function removeRange(key: PatternKey, index: number) {
    onPatternsChange({
      ...patterns,
      [key]: {
        ...patterns[key],
        ranges: patterns[key].ranges.filter((_, i) => i !== index),
      },
    });
  }

  const endTimeSlots = (startTime: string) =>
    TIME_SLOTS.filter((slot) => slot > startTime);

  return (
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
  );
}
