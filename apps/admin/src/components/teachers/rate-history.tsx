"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Check, X } from "lucide-react";
import { addRateChange, updateRateChange } from "@/lib/actions/teachers";

type RateEntry = {
  id: string;
  groupLessonRate: number;
  individualLessonRate: number;
  effectiveFrom: Date;
  changedBy: { firstName: string; lastName: string } | null;
};

type PriceLimits = { maxGroupRate: number; maxIndividualRate: number } | null;

export function RateHistory({
  teacherId,
  rates,
  priceLimits,
}: {
  teacherId: string;
  rates: RateEntry[];
  priceLimits: PriceLimits;
}) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const currentRate = rates[0];
  const [groupRate, setGroupRate] = useState(
    currentRate?.groupLessonRate?.toString() ?? "",
  );
  const [indRate, setIndRate] = useState(
    currentRate?.individualLessonRate?.toString() ?? "",
  );
  const [effectiveFrom, setEffectiveFrom] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGroupRate, setEditGroupRate] = useState("");
  const [editIndRate, setEditIndRate] = useState("");
  const [editEffectiveFrom, setEditEffectiveFrom] = useState("");

  function startEdit(rate: RateEntry) {
    setEditingId(rate.id);
    setEditGroupRate(rate.groupLessonRate.toString());
    setEditIndRate(rate.individualLessonRate.toString());
    setEditEffectiveFrom(formatDateISO(rate.effectiveFrom));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await addRateChange(teacherId, {
        groupLessonRate: Number(groupRate),
        individualLessonRate: Number(indRate),
        effectiveFrom,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Rate change added");
        setShowAdd(false);
      }
    });
  }

  function handleUpdate() {
    if (!editingId) return;
    startTransition(async () => {
      const result = await updateRateChange(editingId, {
        groupLessonRate: Number(editGroupRate),
        individualLessonRate: Number(editIndRate),
        effectiveFrom: editEffectiveFrom,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Rate updated");
        setEditingId(null);
      }
    });
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateISO(date: Date) {
    return new Date(date).toISOString().split("T")[0]!;
  }

  function formatAmount(amount: number) {
    return amount.toLocaleString("en-US");
  }

  const isEditing = editingId !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Rate History</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
          disabled={isEditing}
        >
          <Plus className="mr-1 size-4" />
          New Rate
        </Button>
      </div>

      {showAdd && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Group Rate (UZS)</label>
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
            <label className="text-xs font-medium">
              Individual Rate (UZS)
            </label>
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
            <label className="text-xs font-medium">
              Effective From (1st of month)
            </label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <Button onClick={handleAdd} disabled={isPending} size="sm">
            {isPending ? "..." : "Add"}
          </Button>
        </div>
      )}

      {rates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rate history.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">
                  Effective From
                </th>
                <th className="px-3 py-2 text-left font-medium">Group Rate</th>
                <th className="px-3 py-2 text-left font-medium">
                  Individual Rate
                </th>
                <th className="px-3 py-2 text-left font-medium">Changed By</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate, i) => {
                const isEditingThis = editingId === rate.id;

                if (isEditingThis) {
                  return (
                    <tr key={rate.id} className="border-t bg-muted/20">
                      <td className="px-3 py-2">
                        <Input
                          type="date"
                          value={editEffectiveFrom}
                          onChange={(e) => setEditEffectiveFrom(e.target.value)}
                          className="h-8 w-[140px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          max={priceLimits?.maxGroupRate}
                          value={editGroupRate}
                          onChange={(e) => setEditGroupRate(e.target.value)}
                          className="h-8 w-[120px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          max={priceLimits?.maxIndividualRate}
                          value={editIndRate}
                          onChange={(e) => setEditIndRate(e.target.value)}
                          className="h-8 w-[120px]"
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {rate.changedBy
                          ? `${rate.changedBy.firstName} ${rate.changedBy.lastName}`
                          : "Initial"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleUpdate}
                            disabled={isPending}
                            className="h-7 w-7 p-0"
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            disabled={isPending}
                            className="h-7 w-7 p-0"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={rate.id}
                    className={i === 0 ? "bg-primary/5 font-medium" : "border-t"}
                  >
                    <td className="px-3 py-2">
                      {formatDate(rate.effectiveFrom)}
                    </td>
                    <td className="px-3 py-2">
                      {formatAmount(rate.groupLessonRate)} UZS
                    </td>
                    <td className="px-3 py-2">
                      {formatAmount(rate.individualLessonRate)} UZS
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {rate.changedBy
                        ? `${rate.changedBy.firstName} ${rate.changedBy.lastName}`
                        : "Initial"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(rate)}
                        disabled={isEditing || isPending}
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
