"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import { groupBaseSchema, type GroupFormValues } from "@/schemas/group";
import { createGroup, updateGroup } from "@/lib/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { AlertTriangle } from "lucide-react";
import { TIME_SLOTS } from "@/lib/constants";

const LEVELS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "ELEMENTARY", label: "Elementary" },
  { value: "PRE_INTERMEDIATE", label: "Pre-Intermediate" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "UPPER_INTERMEDIATE", label: "Upper-Intermediate" },
  { value: "IELTS", label: "IELTS" },
] as const;

const DAY_OPTIONS = [
  { value: [1, 3, 5], label: "Mon / Wed / Fri" },
  { value: [2, 4, 6], label: "Tue / Thu / Sat" },
] as const;

const DURATION_OPTIONS = [
  { value: 80, label: "80 min" },
  { value: 60, label: "60 min" },
] as const;

type TeacherOption = {
  id: string;
  firstName: string;
  lastName: string;
  zoomEmail: string | null;
  rateChanges: { id: string }[];
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
};

interface GroupFormProps {
  defaultValues?: GroupFormValues;
  groupId?: string;
  teachers: TeacherOption[];
  prefill?: {
    teacherId?: string;
    days?: number[];
    startTime?: string;
  };
}

export function GroupForm({ defaultValues, groupId, teachers, prefill }: GroupFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!groupId;
  const isPrefilled = !!(prefill?.teacherId && prefill?.days?.length && prefill?.startTime);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupBaseSchema),
    defaultValues: defaultValues ?? {
      type: "GROUP",
      teacherId: prefill?.teacherId ?? "",
      days: prefill?.days ?? [],
      startTime: prefill?.startTime ?? "",
      durationMinutes: 80,
      maxStudents: 6,
      startDate: "",
    },
  });

  function onSubmit(values: GroupFormValues) {
    startTransition(async () => {
      const result = isEdit
        ? await updateGroup(groupId!, values)
        : await createGroup(values);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  // Compute available time slots based on selected teacher's availability and selected days
  const watchedTeacherId = form.watch("teacherId");
  const watchedDays = form.watch("days");
  const selectedTeacher = teachers.find((t) => t.id === watchedTeacherId);

  const availableTimeSlots = (() => {
    if (!selectedTeacher || watchedDays.length === 0) return TIME_SLOTS;
    // Find availability entries that match any of the selected days
    const matchingAvail = selectedTeacher.availability.filter((a) =>
      watchedDays.includes(a.dayOfWeek),
    );
    if (matchingAvail.length === 0) return [];
    // Only show time slots that fall within at least one availability window
    return TIME_SLOTS.filter((slot) =>
      matchingAvail.some((a) => slot >= a.startTime && slot < a.endTime),
    );
  })();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Type Toggle */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <div className="flex gap-2">
                {(["GROUP", "INDIVIDUAL"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={isEdit || isPrefilled}
                    onClick={() => {
                      field.onChange(t);
                      form.setValue(
                        "maxStudents",
                        t === "INDIVIDUAL" ? 1 : 6,
                      );
                    }}
                    className={`rounded-md border px-4 py-1.5 text-sm transition-colors ${
                      field.value === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-accent"
                    } ${isEdit || isPrefilled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {t === "GROUP" ? "Group" : "Individual"}
                  </button>
                ))}
              </div>
              {isEdit && (
                <FormDescription>Type cannot be changed after creation</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Teacher Select */}
        <FormField
          control={form.control}
          name="teacherId"
          render={({ field }) => {
            const fieldTeacher = teachers.find((t) => t.id === field.value);
            const hasNoRates = fieldTeacher && fieldTeacher.rateChanges.length === 0;
            const hasNoZoomEmail = fieldTeacher && !fieldTeacher.zoomEmail;
            return (
              <FormItem>
                <FormLabel>Teacher</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isPrefilled}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select teacher..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                        {t.rateChanges.length === 0 ? " (no rates)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasNoRates && (
                  <div className="flex items-center gap-1.5 text-sm text-amber-600">
                    <AlertTriangle className="size-3.5" />
                    This teacher has no rate history. Add rates first.
                  </div>
                )}
                {hasNoZoomEmail && !hasNoRates && (
                  <div className="flex items-center gap-1.5 text-sm text-amber-600">
                    <AlertTriangle className="size-3.5" />
                    No Zoom email configured. A Zoom meeting won&apos;t be created.
                  </div>
                )}
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {/* Days Toggle */}
        <FormField
          control={form.control}
          name="days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Days</FormLabel>
              <div className="flex gap-2">
                {DAY_OPTIONS.map((opt) => {
                  const selected =
                    JSON.stringify([...field.value].sort()) ===
                    JSON.stringify([...opt.value]);
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={isEdit || isPrefilled}
                      onClick={() => {
                        field.onChange(selected ? [] : [...opt.value]);
                      }}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      } ${isEdit || isPrefilled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {(isEdit || isPrefilled) && (
                <FormDescription>{isEdit ? "Days cannot be changed after creation" : "Prefilled from schedule"}</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Time & Duration */}
        <div className="grid grid-cols-2 items-start gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isPrefilled || !watchedTeacherId || watchedDays.length === 0 || availableTimeSlots.length === 0}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select time..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableTimeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {watchedTeacherId && watchedDays.length > 0 && availableTimeSlots.length === 0 && (
                  <p className="text-sm text-destructive">
                    No available slots for this teacher on selected days
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="durationMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration</FormLabel>
                <div className="flex gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isEdit}
                      onClick={() => field.onChange(opt.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        field.value === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      } ${isEdit ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Level — only on create */}
        {!isEdit && (
          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select level..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Max Students & Start Date */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="maxStudents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Students</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {!isEdit && (
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} min={new Date().toISOString().split("T")[0]} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {!isEdit && (
          <p className="text-sm text-muted-foreground">
            A Zoom meeting will be created automatically if the teacher has a Zoom email configured.
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.history.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Saving..."
              : isEdit
                ? "Update Group"
                : "Create Group"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
