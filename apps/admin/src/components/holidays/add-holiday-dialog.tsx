"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createHoliday } from "@/lib/actions/holidays";
import { getUzbekistanTodayStr } from "@/lib/helpers/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function AddHolidayDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  // Min date = tomorrow
  const today = getUzbekistanTodayStr();
  const todayDate = new Date(today + "T00:00:00Z");
  const tomorrow = new Date(todayDate.getTime() + 86400000);
  const minDate = tomorrow.toISOString().slice(0, 10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createHoliday({ name, date });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        const parts = [];
        if (result.lessonsAffected > 0)
          parts.push(`${result.lessonsAffected} lesson(s) cancelled`);
        if (result.groupsAffected > 0)
          parts.push(`${result.groupsAffected} group(s) affected`);
        if (result.studentsAdjusted > 0)
          parts.push(`${result.studentsAdjusted} billing period(s) adjusted`);
        if (result.refundsCreated > 0)
          parts.push(`${result.refundsCreated} refund(s) created`);

        const detail = parts.length > 0 ? `: ${parts.join(", ")}` : "";
        toast.success(`Holiday added${detail}`);
        setOpen(false);
        setName("");
        setDate("");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setName("");
          setDate("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 size-4" />
          Add Holiday
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Holiday</DialogTitle>
          <DialogDescription className="sr-only">
            Add a new holiday date
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Navruz"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDate}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name || !date}>
              {isPending ? "Adding..." : "Add Holiday"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
