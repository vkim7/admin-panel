"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setPreferredSchedule } from "@/lib/actions/lead-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TIME_SLOTS, DAYS_LABEL, LESSON_LABEL } from "@/lib/constants";
import type { LessonPreference, PreferredLanguage } from "@eng/database";

const DAY_PATTERN_MWF = [1, 3, 5];
const DAY_PATTERN_TTS = [2, 4, 6];

type DaysMode = "mwf" | "tts" | "any" | "none";
type TimeMode = "specific" | "any" | "none";

const LANG_LABEL: Record<PreferredLanguage, string> = {
  UZBEK: "Uzbek",
  RUSSIAN: "Russian",
  ANY: "Any",
};

const LESSON_OPTIONS: { id: LessonPreference; label: string }[] = [
  { id: "EITHER", label: "Any" },
  { id: "GROUP", label: "Group" },
  { id: "INDIVIDUAL", label: "Individual" },
];

const LANG_OPTIONS: { id: PreferredLanguage; label: string }[] = [
  { id: "ANY", label: "Any" },
  { id: "UZBEK", label: "Uzbek" },
  { id: "RUSSIAN", label: "Russian" },
];

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

/** Sensible default for preferredLanguage when admin opens the dialog for the
 * first time: prefer the saved value, fall back to mapping the form's URL
 * locale (`language`). */
function deriveInitialLanguage(
  saved: PreferredLanguage | null,
  formLanguage: string,
): PreferredLanguage | null {
  if (saved) return saved;
  if (formLanguage === "uz") return "UZBEK";
  if (formLanguage === "ru") return "RUSSIAN";
  return null;
}

function dateToInputValue(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

function PreferencesDialog({
  leadId,
  initialDays,
  initialDaysAny,
  initialSlots,
  initialSlotsAny,
  initialLessonPreference,
  initialPreferredLanguage,
  initialDateOfBirth,
  formLanguage,
  open,
  onOpenChange,
  onChange,
}: {
  leadId: string;
  initialDays: number[];
  initialDaysAny: boolean;
  initialSlots: string[];
  initialSlotsAny: boolean;
  initialLessonPreference: LessonPreference | null;
  initialPreferredLanguage: PreferredLanguage | null;
  initialDateOfBirth: Date | null;
  formLanguage: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChange?: () => Promise<void> | void;
}) {
  const [daysMode, setDaysMode] = useState<DaysMode>(
    deriveDaysMode(initialDays, initialDaysAny),
  );
  const [draftSlots, setDraftSlots] = useState<string[]>(initialSlots);
  const [slotsAny, setSlotsAny] = useState<boolean>(initialSlotsAny);
  const [lessonPref, setLessonPref] = useState<LessonPreference | null>(
    initialLessonPreference,
  );
  const [language, setLanguage] = useState<PreferredLanguage | null>(
    deriveInitialLanguage(initialPreferredLanguage, formLanguage),
  );
  const [dob, setDob] = useState<string>(dateToInputValue(initialDateOfBirth));
  const [isPending, startTransition] = useTransition();

  // All five fields are required — protects against silently wiping captured
  // data and aligns the dialog with the conversion gate's expectations.
  const canSave =
    daysMode !== "none" &&
    (slotsAny || draftSlots.length > 0) &&
    lessonPref !== null &&
    language !== null &&
    dob.length > 0;

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
    setLessonPref(initialLessonPreference);
    setLanguage(deriveInitialLanguage(initialPreferredLanguage, formLanguage));
    setDob(dateToInputValue(initialDateOfBirth));
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
        lessonPreference: lessonPref,
        preferredLanguage: language,
        dateOfBirth: dob || null,
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
            <Label className="mb-1.5 block">Language</Label>
            <div className="flex gap-2">
              {LANG_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  size="sm"
                  variant={language === opt.id ? "default" : "outline"}
                  onClick={() => setLanguage(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Lesson type</Label>
            <div className="flex gap-2">
              {LESSON_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  size="sm"
                  variant={lessonPref === opt.id ? "default" : "outline"}
                  onClick={() => setLessonPref(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

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

          <div>
            <Label htmlFor="dob-input" className="mb-1.5 block">
              Date of birth
            </Label>
            <Input
              id="dob-input"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-auto"
            />
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
            title={!canSave ? "Fill all five fields to save" : undefined}
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
  lessonPreference,
  preferredLanguage,
  dateOfBirth,
  formLanguage,
  status,
  onChange,
}: {
  leadId: string;
  preferredDays: number[];
  preferredDaysAny: boolean;
  preferredTimeSlots: string[];
  preferredTimeSlotsAny: boolean;
  lessonPreference: LessonPreference | null;
  preferredLanguage: PreferredLanguage | null;
  dateOfBirth: Date | null;
  /** Form-submission locale ("uz" / "ru") — used to seed the language radio
   * when no explicit preferredLanguage is captured yet. */
  formLanguage: string;
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

  const lessonLabel = lessonPreference ? LESSON_LABEL[lessonPreference] : null;
  const languageLabel = preferredLanguage
    ? LANG_LABEL[preferredLanguage]
    : null;
  const dobLabel = dateOfBirth
    ? new Date(dateOfBirth).toISOString().slice(0, 10)
    : null;

  // Only render the captured values once all 5 fields are set. Partial values
  // (typically intake-prefilled lessonPreference / preferredLanguage) misled
  // admins into thinking preferences were already confirmed — the dialog
  // pre-populates from the same data, so they're still visible behind Change.
  const allCaptured =
    languageLabel && lessonLabel && daysLabel && timeLabel && dobLabel;

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

      {allCaptured && (
        <div className="space-y-1.5">
          <div className="text-sm">
            <span className="text-muted-foreground">Language: </span>
            {languageLabel}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Lesson type: </span>
            {lessonLabel}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Days: </span>
            {daysLabel}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Time: </span>
            {timeLabel}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Date of birth: </span>
            {dobLabel}
          </div>
        </div>
      )}

      <PreferencesDialog
        leadId={leadId}
        initialDays={preferredDays}
        initialDaysAny={preferredDaysAny}
        initialSlots={preferredTimeSlots}
        initialSlotsAny={preferredTimeSlotsAny}
        initialLessonPreference={lessonPreference}
        initialPreferredLanguage={preferredLanguage}
        initialDateOfBirth={dateOfBirth}
        formLanguage={formLanguage}
        open={open}
        onOpenChange={setOpen}
        onChange={onChange}
      />
    </section>
  );
}

// Keep DAYS_LABEL importable elsewhere — used to be a re-export here.
export { DAYS_LABEL };
