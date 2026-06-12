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
import { Checkbox } from "@/components/ui/checkbox";
import { recordTeacherUnavailability } from "@/lib/actions/teacher-unavailability";
import { Plus } from "lucide-react";
import { TIME_SLOTS, AVAILABILITY_END_SLOTS } from "@/lib/constants";

interface UnavailabilityFormProps {
  teacherId: string;
}

export function UnavailabilityForm({ teacherId }: UnavailabilityFormProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [wholeDay, setWholeDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setOpen(false);
    setDate("");
    setWholeDay(true);
    setStartTime("");
    setEndTime("");
    setReason("");
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-3.5" />
        Add
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Unavailability</DialogTitle>
            <DialogDescription>
              Affected scheduled lessons will be automatically set to pending resolution.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="whole-day"
                checked={wholeDay}
                onCheckedChange={(v) => {
                  setWholeDay(!!v);
                  if (v) {
                    setStartTime("");
                    setEndTime("");
                  }
                }}
              />
              <Label htmlFor="whole-day">Whole day</Label>
            </div>

            {!wholeDay && (
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>From</Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select time..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>To (optional)</Label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select time..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_END_SLOTS.filter((slot) => !startTime || slot > startTime).map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Sick leave, personal"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button
              disabled={!date || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await recordTeacherUnavailability({
                    teacherId,
                    date,
                    startTime: wholeDay ? null : (startTime || null),
                    endTime: wholeDay ? null : (endTime || null),
                    reason: reason || null,
                  });
                  if (result?.error) {
                    toast.error(result.error);
                  } else {
                    const msg = result.affectedLessons
                      ? `Unavailability recorded. ${result.affectedLessons} lesson${result.affectedLessons === 1 ? "" : "s"} set to pending.`
                      : "Unavailability recorded.";
                    toast.success(msg);
                    handleClose();
                  }
                });
              }}
            >
              {isPending ? "Recording..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
