"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Trash2, Plus } from "lucide-react";
import {
  addAvailabilityBlock,
  removeAvailabilityBlock,
} from "@/lib/actions/teachers";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
] as const;

const DAY_SHORT: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

type Block = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export function AvailabilityEditor({
  teacherId,
  blocks,
}: {
  teacherId: string;
  blocks: Block[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Block | null>(null);

  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("22:00");

  // Group blocks by day
  const grouped = new Map<number, Block[]>();
  for (const block of blocks) {
    const list = grouped.get(block.dayOfWeek) ?? [];
    list.push(block);
    grouped.set(block.dayOfWeek, list);
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await addAvailabilityBlock(teacherId, {
        dayOfWeek,
        startTime,
        endTime,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Availability block added");
        setShowAdd(false);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await removeAvailabilityBlock(teacherId, deleteTarget.id);
      toast.success("Availability block removed");
      setDeleteTarget(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Availability</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="mr-1 size-4" />
          Add Block
        </Button>
      </div>

      {showAdd && (
        <div className="flex items-end gap-3 rounded-md border p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Day</label>
            <Select
              value={String(dayOfWeek)}
              onValueChange={(v) => setDayOfWeek(Number(v))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Start</label>
            <Input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="14:00"
              className="w-[100px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">End</label>
            <Input
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="22:00"
              className="w-[100px]"
            />
          </div>
          <Button onClick={handleAdd} disabled={isPending} size="sm">
            {isPending ? "..." : "Add"}
          </Button>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No availability blocks set.
        </p>
      ) : (
        <div className="space-y-2">
          {DAYS.map((day) => {
            const dayBlocks = grouped.get(day.value);
            if (!dayBlocks) return null;
            return (
              <div key={day.value} className="flex items-center gap-3">
                <span className="w-12 text-sm font-medium">
                  {DAY_SHORT[day.value]}
                </span>
                <div className="flex flex-wrap gap-2">
                  {dayBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-sm"
                    >
                      {block.startTime}–{block.endTime}
                      <button
                        onClick={() => setDeleteTarget(block)}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove availability block"
        description={
          deleteTarget
            ? `Remove ${DAY_SHORT[deleteTarget.dayOfWeek]} ${deleteTarget.startTime}–${deleteTarget.endTime}?`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={handleDelete}
      />
    </div>
  );
}
