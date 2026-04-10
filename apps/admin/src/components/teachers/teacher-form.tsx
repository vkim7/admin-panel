"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  teacherSchema,
  rateChangeSchema,
  type TeacherFormValues,
} from "@/schemas/teacher";
import { createTeacherFull, updateTeacher } from "@/lib/actions/teachers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  type PatternKey,
  type PatternState,
  initialPatternState,
  findOverlap,
  patternsToBlocks,
} from "@/lib/availability-patterns";
import { AvailabilityPatternPicker } from "./availability-pattern-picker";

const LEVELS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "ELEMENTARY", label: "Elementary" },
  { value: "PRE_INTERMEDIATE", label: "Pre-Intermediate" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "UPPER_INTERMEDIATE", label: "Upper-Intermediate" },
  { value: "IELTS", label: "IELTS" },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

type PriceLimits = { maxGroupRate: number; maxIndividualRate: number } | null;

interface TeacherFormProps {
  defaultValues?: TeacherFormValues;
  teacherId?: string;
  priceLimits?: PriceLimits;
}

export function TeacherForm({ defaultValues, teacherId, priceLimits }: TeacherFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!teacherId;

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: defaultValues ?? {
      firstName: "",
      lastName: "",
      phone: "",
      pinfl: "",
      zoomEmail: null,
      levels: [],
      teachingLanguage: "" as unknown as "UZBEK" | "RUSSIAN" | "ANY",
    },
  });

  // Rate state (create mode only)
  const [groupRate, setGroupRate] = useState("");
  const [indRate, setIndRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [rateError, setRateError] = useState<string | null>(null);

  // Availability state (create mode only)
  const [patterns, setPatterns] = useState<Record<PatternKey, PatternState>>(
    initialPatternState,
  );

  function formatAmount(amount: number) {
    return amount.toLocaleString("en-US");
  }

  function onSubmit(values: TeacherFormValues) {
    if (isEdit) {
      startTransition(async () => {
        const result = await updateTeacher(teacherId!, values);
        if (result?.error) toast.error(result.error);
      });
      return;
    }

    // Validate rate fields (all or nothing)
    const hasAnyRate = !!(groupRate || indRate || effectiveFrom);
    const hasAllRate = !!(groupRate && indRate && effectiveFrom);
    if (hasAnyRate && !hasAllRate) {
      setRateError("Fill in all rate fields or leave all empty");
      return;
    }

    let rateData: { groupLessonRate: number; individualLessonRate: number; effectiveFrom: string } | null = null;
    if (hasAllRate) {
      const result = rateChangeSchema.safeParse({
        groupLessonRate: groupRate,
        individualLessonRate: indRate,
        effectiveFrom,
      });
      if (!result.success) {
        setRateError(result.error.issues[0]?.message ?? "Invalid rate data");
        return;
      }
      rateData = result.data;
    }
    setRateError(null);

    // Validate availability overlaps per pattern
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

    const availabilityBlocks = patternsToBlocks(patterns);

    startTransition(async () => {
      const result = await createTeacherFull({
        teacher: values,
        rate: rateData,
        availabilityBlocks: availabilityBlocks.length > 0 ? availabilityBlocks : null,
      });
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Basic Information ── */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <PhoneInput {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pinfl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PINFL</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="14-digit tax ID"
                  maxLength={14}
                  inputMode="numeric"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="zoomEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zoom Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  {...field}
                  value={field.value ?? ""}
                  placeholder="teacher@example.com"
                />
              </FormControl>
              <FormDescription>
                Zoom account email. Required for automatic meeting creation.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="levels"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Levels</FormLabel>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((level) => {
                  const selected = field.value.includes(level.value);
                  return (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          field.onChange(
                            field.value.filter((v: string) => v !== level.value),
                          );
                        } else {
                          field.onChange([...field.value, level.value]);
                        }
                      }}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="teachingLanguage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teaching Language</FormLabel>
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    { value: "ANY", label: "Both" },
                    { value: "UZBEK", label: "Uzbek" },
                    { value: "RUSSIAN", label: "Russian" },
                  ] as const
                ).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="teachingLanguage"
                      checked={field.value === opt.value}
                      onChange={() => field.onChange(opt.value)}
                      className="border-input"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Initial Rate (create only, optional) ── */}
        {!isEdit && (
          <>
            <Separator />
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Initial Rate</h3>
                <p className="text-muted-foreground text-sm">
                  Optional — you can add rates later from the teacher detail page.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Group Rate (UZS)</label>
                  <Input
                    type="number"
                    min={1}
                    max={priceLimits?.maxGroupRate}
                    value={groupRate}
                    onChange={(e) => setGroupRate(e.target.value)}
                    className="w-[140px]"
                  />
                  {priceLimits && (
                    <p className="text-muted-foreground text-xs">
                      Max: {formatAmount(priceLimits.maxGroupRate)}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Individual Rate (UZS)</label>
                  <Input
                    type="number"
                    min={1}
                    max={priceLimits?.maxIndividualRate}
                    value={indRate}
                    onChange={(e) => setIndRate(e.target.value)}
                    className="w-[140px]"
                  />
                  {priceLimits && (
                    <p className="text-muted-foreground text-xs">
                      Max: {formatAmount(priceLimits.maxIndividualRate)}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Effective From (1st of month)
                  </label>
                  <Input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
              </div>
              {rateError && (
                <p className="text-sm text-destructive">{rateError}</p>
              )}
            </div>
          </>
        )}

        {/* ── Availability (create only, optional) ── */}
        {!isEdit && (
          <>
            <Separator />
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Availability</h3>
                <p className="text-muted-foreground text-sm">
                  Optional — you can set availability later from the teacher detail page.
                </p>
              </div>
              <AvailabilityPatternPicker
                patterns={patterns}
                onPatternsChange={setPatterns}
              />
            </div>
          </>
        )}

        {/* ── Actions ── */}
        <Separator className={isEdit ? "hidden" : ""} />
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.history.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : isEdit ? "Update Teacher" : "Create Teacher"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
