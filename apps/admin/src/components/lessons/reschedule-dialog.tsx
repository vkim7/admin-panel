"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { offlineRescheduleLesson } from "@/lib/actions/lessons";
import { TIME_SLOTS } from "@/lib/constants";

interface RescheduleDialogProps {
  lessonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RescheduleDialog({
  lessonId,
  open,
  onOpenChange,
}: RescheduleDialogProps) {
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    onOpenChange(false);
    setNewDate("");
    setNewStartTime("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Offline Reschedule</DialogTitle>
          <DialogDescription>
            Move this lesson to a different date and time. The original date will be preserved. This does not count toward the cancellation limit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>New date</Label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>New time</Label>
            <Select onValueChange={setNewStartTime} value={newStartTime}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select time..." />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button
            disabled={!newDate || !newStartTime || isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await offlineRescheduleLesson({
                  lessonId,
                  newDate,
                  newStartTime,
                });
                if (result?.error) {
                  toast.error(result.error);
                } else {
                  toast.success("Lesson rescheduled");
                  handleClose();
                }
              });
            }}
          >
            {isPending ? "Rescheduling..." : "Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
