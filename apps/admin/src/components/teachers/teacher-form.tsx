"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  teacherSchema,
  type TeacherFormValues,
} from "@/schemas/teacher";
import { createTeacher, updateTeacher } from "@/lib/actions/teachers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const LEVELS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "ELEMENTARY", label: "Elementary" },
  { value: "PRE_INTERMEDIATE", label: "Pre-Intermediate" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "UPPER_INTERMEDIATE", label: "Upper-Intermediate" },
  { value: "IELTS", label: "IELTS" },
] as const;

interface TeacherFormProps {
  defaultValues?: TeacherFormValues;
  teacherId?: string;
}

export function TeacherForm({ defaultValues, teacherId }: TeacherFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!teacherId;

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: defaultValues ?? {
      firstName: "",
      lastName: "",
      phone: "",
      zoomEmail: null,
      levels: [],
      teachingLanguage: "" as unknown as "UZBEK" | "RUSSIAN" | "ANY",
    },
  });

  function onSubmit(values: TeacherFormValues) {
    startTransition(async () => {
      const result = isEdit
        ? await updateTeacher(teacherId!, values)
        : await createTeacher(values);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
