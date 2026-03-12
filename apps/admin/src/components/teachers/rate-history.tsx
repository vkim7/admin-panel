"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { addRateChange } from "@/lib/actions/teachers";

type RateEntry = {
  id: string;
  groupLessonRate: number;
  individualLessonRate: number;
  effectiveFrom: Date;
  changedBy: { firstName: string; lastName: string } | null;
};

export function RateHistory({
  teacherId,
  rates,
}: {
  teacherId: string;
  rates: RateEntry[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);

  // Prefill with current rates
  const currentRate = rates[0];
  const [groupRate, setGroupRate] = useState(
    currentRate?.groupLessonRate?.toString() ?? "",
  );
  const [indRate, setIndRate] = useState(
    currentRate?.individualLessonRate?.toString() ?? "",
  );
  const [effectiveFrom, setEffectiveFrom] = useState("");

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

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatAmount(amount: number) {
    return amount.toLocaleString("en-US");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Rate History</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="mr-1 size-4" />
          New Rate
        </Button>
      </div>

      {showAdd && (
        <div className="flex items-end gap-3 rounded-md border p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Group Rate (UZS)</label>
            <Input
              type="number"
              value={groupRate}
              onChange={(e) => setGroupRate(e.target.value)}
              className="w-[140px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">
              Individual Rate (UZS)
            </label>
            <Input
              type="number"
              value={indRate}
              onChange={(e) => setIndRate(e.target.value)}
              className="w-[140px]"
            />
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
              </tr>
            </thead>
            <tbody>
              {rates.map((rate, i) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
