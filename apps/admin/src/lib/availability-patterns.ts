// Shared types, constants, and helpers for availability pattern editing.
// Used by both the teacher creation form and the detail-page availability editor.

export type PatternKey = "MWF" | "TTS";
export type TimeRange = { startTime: string; endTime: string };
export type PatternState = { enabled: boolean; ranges: TimeRange[] };
export type AvailabilityBlock = { dayOfWeek: number; startTime: string; endTime: string };

export const PATTERNS: Record<PatternKey, { label: string; days: readonly number[] }> = {
  MWF: { label: "Mon, Wed, Fri", days: [1, 3, 5] },
  TTS: { label: "Tue, Thu, Sat", days: [2, 4, 6] },
};

export const DEFAULT_START = "14:30";
export const DEFAULT_END = "22:00";

/** Empty pattern state for new teacher creation. */
export function initialPatternState(): Record<PatternKey, PatternState> {
  return {
    MWF: { enabled: false, ranges: [{ startTime: DEFAULT_START, endTime: DEFAULT_END }] },
    TTS: { enabled: false, ranges: [{ startTime: DEFAULT_START, endTime: DEFAULT_END }] },
  };
}

/** Build pattern states from existing DB blocks (for editing existing availability). */
export function buildPatternStates(
  blocks: AvailabilityBlock[],
): Record<PatternKey, PatternState> {
  const blocksByDay = new Map<number, AvailabilityBlock[]>();
  for (const b of blocks) {
    const list = blocksByDay.get(b.dayOfWeek) ?? [];
    list.push(b);
    blocksByDay.set(b.dayOfWeek, list);
  }

  function buildForPattern(days: readonly number[]): PatternState {
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

/** Detect enabled patterns from blocks (for read-only display). */
export function detectPatternDisplay(
  blocks: AvailabilityBlock[],
): { key: PatternKey; ranges: TimeRange[] }[] {
  const states = buildPatternStates(blocks);
  const result: { key: PatternKey; ranges: TimeRange[] }[] = [];
  for (const key of ["MWF", "TTS"] as PatternKey[]) {
    if (states[key].enabled) {
      result.push({ key, ranges: states[key].ranges });
    }
  }
  return result;
}

/** Find overlapping time ranges within a single list. Returns conflicting indices or null. */
export function findOverlap(ranges: TimeRange[]): [number, number] | null {
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

/** Convert pattern state to flat availability blocks for submission. */
export function patternsToBlocks(
  patterns: Record<PatternKey, PatternState>,
): AvailabilityBlock[] {
  const blocks: AvailabilityBlock[] = [];
  for (const key of ["MWF", "TTS"] as PatternKey[]) {
    const pattern = patterns[key];
    if (!pattern.enabled) continue;
    for (const day of PATTERNS[key].days) {
      for (const range of pattern.ranges) {
        blocks.push({ dayOfWeek: day, startTime: range.startTime, endTime: range.endTime });
      }
    }
  }
  return blocks;
}

/** Server-side overlap check on flat blocks grouped by day. Returns error message or null. */
export function findOverlappingBlocks(blocks: AvailabilityBlock[]): string | null {
  const byDay = new Map<number, AvailabilityBlock[]>();
  for (const block of blocks) {
    const list = byDay.get(block.dayOfWeek) ?? [];
    list.push(block);
    byDay.set(block.dayOfWeek, list);
  }
  for (const [, dayBlocks] of byDay) {
    for (let i = 0; i < dayBlocks.length; i++) {
      for (let j = i + 1; j < dayBlocks.length; j++) {
        const a = dayBlocks[i]!;
        const b = dayBlocks[j]!;
        if (a.startTime < b.endTime && a.endTime > b.startTime) {
          return `Overlapping ranges: ${a.startTime}–${a.endTime} and ${b.startTime}–${b.endTime}`;
        }
      }
    }
  }
  return null;
}
