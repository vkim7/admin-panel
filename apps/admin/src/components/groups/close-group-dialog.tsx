"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { closeGroup } from "@/lib/actions/group-close";
import {
  GROUP_CLOSED_REASONS,
  type CloseGroupInput,
} from "@/schemas/group-close";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REASON_LABEL: Record<(typeof GROUP_CLOSED_REASONS)[number], string> = {
  STUDENTS_LEFT: "All students left",
  LOW_ENROLLMENT: "Low enrollment",
  ADMIN_ERROR: "Created in error",
  OTHER: "Other",
};

interface CloseGroupDialogProps {
  groupId: string;
  groupPublicId: string;
  futureLessonCount: number;
  futureExamCount: number;
  hasZoomMeeting: boolean;
}

export function CloseGroupDialog({
  groupId,
  groupPublicId,
  futureLessonCount,
  futureExamCount,
  hasZoomMeeting,
}: CloseGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CloseGroupInput["reason"] | "">("");
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    if (!reason) return;
    startTransition(async () => {
      const result = await closeGroup({ groupId, reason });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Group ${groupPublicId} closed.`);
      setOpen(false);
      setReason("");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setReason("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <XCircle className="mr-1 size-4" />
          Close
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close {groupPublicId}</DialogTitle>
          <DialogDescription>
            Retire this group. Used when all students have left and no
            graduation or merge applies. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as CloseGroupInput["reason"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {GROUP_CLOSED_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REASON_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">This will:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {futureLessonCount > 0 && (
                <li>
                  Cancel {futureLessonCount} future lesson
                  {futureLessonCount === 1 ? "" : "s"} and free the teacher's
                  schedule
                </li>
              )}
              {futureExamCount > 0 && (
                <li>
                  Cancel {futureExamCount} future exam
                  {futureExamCount === 1 ? "" : "s"}
                </li>
              )}
              {hasZoomMeeting && <li>Delete the recurring Zoom meeting</li>}
              <li>Mark the group as closed</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Past lessons, attendance, billing, and student records are
              preserved.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClose}
            disabled={!reason || isPending}
          >
            {isPending ? "Closing..." : "Close group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
