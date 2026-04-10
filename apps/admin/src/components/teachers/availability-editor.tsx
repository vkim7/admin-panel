"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from "lucide-react";
import { setAvailability } from "@/lib/actions/teachers";
import {
  type PatternKey,
  type PatternState,
  type AvailabilityBlock,
  PATTERNS,
  buildPatternStates,
  detectPatternDisplay,
  findOverlap,
  patternsToBlocks,
} from "@/lib/availability-patterns";
import { AvailabilityPatternPicker } from "./availability-pattern-picker";

export function AvailabilityEditor({
  teacherId,
  blocks,
}: {
  teacherId: string;
  blocks: AvailabilityBlock[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showEditor, setShowEditor] = useState(false);
  const [patterns, setPatterns] = useState<Record<PatternKey, PatternState>>(
    () => buildPatternStates(blocks),
  );

  function handleSave() {
    // Check overlaps within each enabled pattern
    for (const key of ["MWF", "TTS"] as PatternKey[]) {
      const pattern = patterns[key];
      if (!pattern.enabled) continue;

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
    }

    const allBlocks = patternsToBlocks(patterns);

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
          <AvailabilityPatternPicker
            patterns={patterns}
            onPatternsChange={setPatterns}
          />

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
