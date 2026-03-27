"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  promotionBaseSchema,
  type PromotionFormValues,
} from "@/schemas/promotion";
import { createPromotion, updatePromotion } from "@/lib/actions/promotions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEVELS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "ELEMENTARY", label: "Elementary" },
  { value: "PRE_INTERMEDIATE", label: "Pre-Intermediate" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "UPPER_INTERMEDIATE", label: "Upper-Intermediate" },
  { value: "IELTS", label: "IELTS" },
] as const;

const GROUP_TYPES = [
  { value: "GROUP", label: "Group" },
  { value: "INDIVIDUAL", label: "Individual" },
] as const;

const PROMOTION_TYPES = [
  { value: "SEASONAL", label: "Seasonal" },
  { value: "FAMILY", label: "Family" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WIN_BACK", label: "Win-Back" },
  { value: "TRIAL", label: "Trial" },
  { value: "PROMO_CODE", label: "Promo Code" },
  { value: "APOLOGY", label: "Apology" },
  { value: "REWARD", label: "Reward" },
] as const;

interface PromotionFormProps {
  defaultValues?: PromotionFormValues;
  promotionId?: string;
}

export function PromotionForm({ defaultValues, promotionId }: PromotionFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!promotionId;

  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionBaseSchema),
    defaultValues: defaultValues ?? {
      name: "",
      type: "REWARD" as const,
      discountType: "PERCENTAGE" as const,
      discountPercent: null,
      discountAmount: null,
      levels: [],
      groupTypes: [],
      isRecurring: false,
      recurringMonths: null,
      maxUsesPerStudent: null,
      maxUsesTotal: null,
      validityDays: null,
      validFrom: null,
      validTo: null,
      code: null,
      isActive: true,
    },
  });

  const discountType = form.watch("discountType");
  const isRecurring = form.watch("isRecurring");

  function onSubmit(values: PromotionFormValues) {
    startTransition(async () => {
      const result = isEdit
        ? await updatePromotion(promotionId!, values)
        : await createPromotion(values);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name + Type */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Summer 2026 Campaign" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROMOTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Discount Type + Value */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="discountType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount Type</FormLabel>
                <Select
                  onValueChange={(val) => {
                    field.onChange(val);
                    if (val === "PERCENTAGE") {
                      form.setValue("discountAmount", null);
                    } else {
                      form.setValue("discountPercent", null);
                    }
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {discountType === "PERCENTAGE" ? (
            <FormField
              control={form.control}
              name="discountPercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount %</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="10"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="discountAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount Amount (UZS)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="50000"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Level Scope */}
        <FormField
          control={form.control}
          name="levels"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Level Scope</FormLabel>
              <FormDescription>Leave empty for all levels</FormDescription>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((level) => {
                  const selected = field.value.includes(level.value);
                  return (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          field.onChange(field.value.filter((v: string) => v !== level.value));
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

        {/* Group Type Scope */}
        <FormField
          control={form.control}
          name="groupTypes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Group Type Scope</FormLabel>
              <FormDescription>Leave empty for all types</FormDescription>
              <div className="flex flex-wrap gap-2">
                {GROUP_TYPES.map((gt) => {
                  const selected = field.value.includes(gt.value);
                  return (
                    <button
                      key={gt.value}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          field.onChange(field.value.filter((v: string) => v !== gt.value));
                        } else {
                          field.onChange([...field.value, gt.value]);
                        }
                      }}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {gt.label}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Recurring */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="isRecurring"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recurring</FormLabel>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: false, label: "One-time" },
                    { value: true, label: "Recurring" },
                  ].map((opt) => (
                    <label key={String(opt.value)} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={field.value === opt.value}
                        onChange={() => {
                          field.onChange(opt.value);
                          if (!opt.value) form.setValue("recurringMonths", null);
                        }}
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
          {isRecurring && (
            <FormField
              control={form.control}
              name="recurringMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recurring Months</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Leave empty for indefinite"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Limits */}
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="maxUsesPerStudent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Uses / Student</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxUsesTotal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Uses Total</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="validityDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Validity Days</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Never expires"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Campaign Window */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="validFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid From</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : e.target.value)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="validTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid To</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : e.target.value)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Code + Active */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Promo Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Optional — e.g. SUMMER2026"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : e.target.value)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: true, label: "Active" },
                    { value: false, label: "Inactive" },
                  ].map((opt) => (
                    <label key={String(opt.value)} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
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
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.history.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : isEdit ? "Update Promotion" : "Create Promotion"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
