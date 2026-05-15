"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setPreferredSchedule } from "@/lib/actions/lead-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TIME_SLOTS, DAYS_LABEL } from "@/lib/constants";

const DAY_PATTERN_MWF = [1, 3, 5];
const DAY_PATTERN_TTS = [2, 4, 6];

type DaysMode = "mwf" | "tts" | "any" | "none";
type TimeMode = "specific" | "any" | "none";

function daysKey(days: number[]): string {
  return [...days].sort((a, b) => a - b).join(",");
}

function deriveDaysMode(days: number[], anyFlag: boolean): DaysMode {
  if (anyFlag) return "any";
  if (days.length === 0) return "none";
  const key = daysKey(days);
  if (key === daysKey(DAY_PATTERN_MWF)) return "mwf";
  if (key === daysKey(DAY_PATTERN_TTS)) return "tts";
  return "none";
}

function deriveTimeMode(slots: string[], anyFlag: boolean): TimeMode {
  if (anyFlag) return "any";
  if (slots.length > 0) return "specific";
  return "none";
}

function PreferencesDialog({
  leadId,
  initialDays,
  initialDaysAny,
  initialSlots,
  initialSlotsAny,
  open,
  onOpenChange,
  onChange,
}: {
  leadId: string;
  initialDays: number[];
  initialDaysAny: boolean;
  initialSlots: string[];
  initialSlotsAny: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChange?: () => Promise<void> | void;
}) {
  const [daysMode, setDaysMode] = useState<DaysMode>(
    deriveDaysMode(initialDays, initialDaysAny),
  );
  const [draftSlots, setDraftSlots] = useState<string[]>(initialSlots);
  const [slotsAny, setSlotsAny] = useState<boolean>(initialSlotsAny);
  const [isPending, startTransition] = useTransition();

  // Each row must have a non-empty selection — prevents silently wiping
  // existing capture by saving an unmarked state (Any is a valid choice).
  const canSave =
    daysMode !== "none" && (slotsAny || draftSlots.length > 0);

  function toggleSlot(slot: string) {
    setSlotsAny(false);
    setDraftSlots((cur) =>
      cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot],
    );
  }

  function pickAnyTime() {
    setSlotsAny(true);
    setDraftSlots([]);
  }

  function reset() {
    setDaysMode(deriveDaysMode(initialDays, initialDaysAny));
    setDraftSlots(initialSlots);
    setSlotsAny(initialSlotsAny);
  }

  function save() {
    const preferredDays =
      daysMode === "mwf"
        ? [...DAY_PATTERN_MWF]
        : daysMode === "tts"
          ? [...DAY_PATTERN_TTS]
          : [];
    const preferredDaysAny = daysMode === "any";
    const preferredTimeSlots = slotsAny ? [] : draftSlots;
    const preferredTimeSlotsAny = slotsAny;

    startTransition(async () => {
      const result = await setPreferredSchedule({
        id: leadId,
        preferredDays,
        preferredTimeSlots,
        preferredDaysAny,
        preferredTimeSlotsAny,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Preferences saved");
      onOpenChange(false);
      await onChange?.();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit preferences</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-1.5 block">Days</Label>
            <div className="flex gap-2">
              {[
                { id: "any" as const, label: "Any" },
                { id: "mwf" as const, label: "MWF" },
                { id: "tts" as const, label: "TTS" },
              ].map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  size="sm"
                  variant={daysMode === opt.id ? "default" : "outline"}
                  onClick={() => setDaysMode(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Time slots</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={pickAnyTime}
                className={`rounded-md border px-2 py-1 text-xs ${
                  slotsAny
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                Any
              </button>
              {TIME_SLOTS.map((slot) => {
                const active = !slotsAny && draftSlots.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={isPending || !canSave}
            title={
              !canSave
                ? "Pick days (or Any) and time slots (or Any)"
                : undefined
            }
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeadPreferences({
  leadId,
  preferredDays,
  preferredDaysAny,
  preferredTimeSlots,
  preferredTimeSlotsAny,
  status,
  onChange,
}: {
  leadId: string;
  preferredDays: number[];
  preferredDaysAny: boolean;
  preferredTimeSlots: string[];
  preferredTimeSlotsAny: boolean;
  status: string;
  onChange?: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const disabled = status === "CONVERTED" || status === "LOST";

  const daysMode = deriveDaysMode(preferredDays, preferredDaysAny);
  const timeMode = deriveTimeMode(preferredTimeSlots, preferredTimeSlotsAny);

  const daysLabel =
    daysMode === "mwf"
      ? "MWF"
      : daysMode === "tts"
        ? "TTS"
        : daysMode === "any"
          ? "Any"
          : null;

  const timeLabel =
    timeMode === "specific"
      ? [...preferredTimeSlots].sort().join(", ")
      : timeMode === "any"
        ? "Any"
        : null;

  return (
    <section className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Preferences</h3>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            Change
          </Button>
        )}
      </div>

      {(daysLabel || timeLabel) && (
        <div className="space-y-1.5">
          {daysLabel && (
            <div className="text-sm">
              <span className="text-muted-foreground">Days: </span>
              {daysLabel}
            </div>
          )}
          {timeLabel && (
            <div className="text-sm">
              <span className="text-muted-foreground">Time: </span>
              {timeLabel}
            </div>
          )}
        </div>
      )}

      <PreferencesDialog
        leadId={leadId}
        initialDays={preferredDays}
        initialDaysAny={preferredDaysAny}
        initialSlots={preferredTimeSlots}
        initialSlotsAny={preferredTimeSlotsAny}
        open={open}
        onOpenChange={setOpen}
        onChange={onChange}
      />
    </section>
  );
}

// Keep DAYS_LABEL importable elsewhere — used to be a re-export here.
export { DAYS_LABEL };
