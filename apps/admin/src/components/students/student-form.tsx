"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { studentBaseSchema, type StudentFormValues } from "@/schemas/student";
import { createStudent, updateStudent } from "@/lib/actions/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/form";
import { FamilySearch, type SelectedFamily } from "@/components/families/family-search";
import { FamilyForm } from "@/components/families/family-form";
import { TIME_SLOTS } from "@/lib/constants";
import { getAge } from "@/lib/helpers/date";

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

const PROGRESS_STAGES = [
  { value: "BEGINNING", label: "Beginning" },
  { value: "MID", label: "Mid" },
  { value: "FINAL", label: "Final" },
] as const;

const LANGUAGES = [
  { value: "ANY", label: "Any" },
  { value: "UZBEK", label: "Uzbek" },
  { value: "RUSSIAN", label: "Russian" },
] as const;

const LESSON_TYPES = [
  { value: "EITHER", label: "Any" },
  { value: "GROUP", label: "Group" },
  { value: "INDIVIDUAL", label: "Individual" },
] as const;

interface StudentFormProps {
  defaultValues?: StudentFormValues;
  studentId?: string;
  initialFamily?: {
    id: string;
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string;
  } | null;
  redirectTo?: string;
  cancelTo?: string;
  leadId?: string;
}

export function StudentForm({
  defaultValues,
  studentId,
  initialFamily,
  redirectTo,
  cancelTo,
  leadId,
}: StudentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<SelectedFamily | null>(
    initialFamily ?? null,
  );

  const isEdit = !!studentId;

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentBaseSchema),
    defaultValues: defaultValues ?? {
      firstName: "",
      lastName: "",
      phone: "",
      dateOfBirth: "",
      level: "" as unknown as "BEGINNER",
      progressStage: "" as unknown as "BEGINNING",
      preferredDays: [],
      preferredTimeSlots: [],
      preferredLanguage: "" as unknown as "UZBEK" | "RUSSIAN" | "ANY",
      preferredLessonType: "" as unknown as "GROUP" | "INDIVIDUAL" | "EITHER",
      familyId: null,
      comment: null,
      promoCode: null,
      referredByCode: null,
    },
  });

  function onSubmit(values: StudentFormValues) {
    startTransition(async () => {
      const result = isEdit
        ? await updateStudent(studentId!, values)
        : await createStudent(values, redirectTo, leadId);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  const dob = form.watch("dateOfBirth");
  const familyId = form.watch("familyId");
  const age = dob ? getAge(new Date(dob)) : null;
  const showFamily = (age !== null && age < 18) || !!familyId;

  function handleCancel() {
    if (cancelTo) {
      window.location.href = cancelTo;
    } else {
      window.history.back();
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
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

        {/* Phone */}
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

        {/* Date of Birth, Level & Progress Stage */}
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
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
          <FormField
            control={form.control}
            name="progressStage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stage</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROGRESS_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Family — only shown for minors (or when a family is already linked) */}
        {showFamily && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <FormField
              control={form.control}
              name="familyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Family (required for minors under 18)</FormLabel>
                  <div className="space-y-2">
                    <FamilySearch
                      selectedFamily={selectedFamily}
                      onSelect={(family) => {
                        field.onChange(family.id);
                        setSelectedFamily(family);
                        setShowFamilyForm(false);
                      }}
                      onClear={() => {
                        field.onChange(null);
                        setSelectedFamily(null);
                      }}
                    />
                    {!selectedFamily && !showFamilyForm && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFamilyForm(true)}
                      >
                        + Create New Family
                      </Button>
                    )}
                    {showFamilyForm && (
                      <FamilyForm
                        onCreated={(family) => {
                          field.onChange(family.id);
                          setSelectedFamily(family);
                          setShowFamilyForm(false);
                        }}
                        onCancel={() => setShowFamilyForm(false)}
                      />
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Preferred Lesson Type */}
        <FormField
          control={form.control}
          name="preferredLessonType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lesson Type</FormLabel>
              <div className="flex gap-2">
                {LESSON_TYPES.map((opt) => {
                  const selected = field.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.onChange(opt.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Preferred Language */}
        <FormField
          control={form.control}
          name="preferredLanguage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preferred Language</FormLabel>
              <div className="flex gap-2">
                {LANGUAGES.map((opt) => {
                  const selected = field.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.onChange(opt.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Days */}
        <FormField
          control={form.control}
          name="preferredDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <span className="font-normal text-muted-foreground">Optional.</span> Days
              </FormLabel>
              <div className="flex gap-2">
                {DAY_OPTIONS.map((opt) => {
                  const selected =
                    JSON.stringify(field.value) ===
                    JSON.stringify(opt.value);
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        field.onChange(
                          selected ? [] : [...opt.value],
                        );
                      }}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Time Slots */}
        <FormField
          control={form.control}
          name="preferredTimeSlots"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <span className="font-normal text-muted-foreground">Optional.</span> Time Slots
              </FormLabel>
              <div className="flex flex-wrap gap-1">
                {TIME_SLOTS.map((slot) => {
                  const selected = field.value.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        field.onChange(
                          selected
                            ? field.value.filter((s: string) => s !== slot)
                            : [...field.value, slot],
                        );
                      }}
                      className={`rounded-md border px-2 py-1 text-xs tabular-nums transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Comment */}
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <span className="font-normal text-muted-foreground">Optional.</span> Comment
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Promo Code & Referral Code — only on creation, mutually exclusive */}
        {!isEdit && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="promoCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <span className="font-normal text-muted-foreground">Optional.</span> Promo Code
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      disabled={!!form.watch("referredByCode")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referredByCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <span className="font-normal text-muted-foreground">Optional.</span> Referral Code
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      disabled={!!form.watch("promoCode")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Saving..."
              : isEdit
                ? "Update Student"
                : "Create Student"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
