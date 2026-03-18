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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cancelLesson } from "@/lib/actions/lessons";
import { X } from "lucide-react";
import type { CancellationReasonOption } from "@/lib/queries/lessons";

interface CancelLessonDialogProps {
  lessonId: string;
  cancellationReasons: CancellationReasonOption[];
}

export function CancelLessonDialog({
  lessonId,
  cancellationReasons,
}: CancelLessonDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedReason = cancellationReasons.find((r) => r.id === selectedReasonId);

  function handleClose() {
    setOpen(false);
    setSelectedReasonId("");
    setOtherReason("");
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <X className="mr-1 size-3.5" />
        Cancel
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Lesson</DialogTitle>
            <DialogDescription>
              This will cancel the lesson and create a replacement at the end of the program.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cancellation reason</Label>
              <Select onValueChange={setSelectedReasonId} value={selectedReasonId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {cancellationReasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedReason?.isOther && (
              <div className="space-y-2">
                <Label>Please specify</Label>
                <Textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Why is this lesson being cancelled?"
                  rows={2}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button
              variant="destructive"
              disabled={!selectedReasonId || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await cancelLesson({
                    lessonId,
                    cancellationReasonId: selectedReasonId,
                    otherCancellationReason: otherReason || null,
                  });
                  if (result?.error) {
                    toast.error(result.error);
                  } else {
                    toast.success("Lesson cancelled, replacement created");
                    handleClose();
                  }
                });
              }}
            >
              {isPending ? "Cancelling..." : "Cancel Lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
