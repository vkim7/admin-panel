"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import { familySchema, type FamilyFormValues } from "@/schemas/family";
import { createFamily } from "@/lib/actions/families";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import type { SelectedFamily } from "@/components/families/family-search";

interface FamilyFormProps {
  onCreated: (family: SelectedFamily) => void;
  onCancel: () => void;
}

export function FamilyForm({ onCreated, onCancel }: FamilyFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FamilyFormValues>({
    resolver: zodResolver(familySchema),
    defaultValues: {
      parentFirstName: "",
      parentLastName: "",
      parentPhone: "",
      name: null,
    },
  });

  function handleCreate() {
    form.handleSubmit((values) => {
      startTransition(async () => {
        const result = await createFamily(values);
        if (result?.error) {
          toast.error(result.error);
        } else if (result?.familyId) {
          toast.success("Family created");
          onCreated({
            id: result.familyId,
            parentFirstName: values.parentFirstName,
            parentLastName: values.parentLastName,
            parentPhone: values.parentPhone,
          });
        }
      });
    })();
  }

  return (
    <div className="rounded-md border bg-background p-4">
      <h4 className="mb-3 text-sm font-medium">Create New Family</h4>
      <FormProvider {...form}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="parentFirstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent First Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentLastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Last Name</FormLabel>
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
            name="parentPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Phone</FormLabel>
                <FormControl>
                  <PhoneInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleCreate}
            >
              {isPending ? "Creating..." : "Create Family"}
            </Button>
          </div>
        </div>
      </FormProvider>
    </div>
  );
}
