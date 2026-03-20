"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveTrialMembership } from "@/lib/actions/group-memberships";
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

interface TrialResolutionDialogProps {
  membershipId: string;
  studentName: string;
  groupId: string;
  groupType: string;
  hasAttendance: boolean;
}

export function TrialResolutionDialog({
  membershipId,
  studentName,
  groupType,
  hasAttendance,
}: TrialResolutionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAction(action: "commit" | "didnt_continue") {
    startTransition(async () => {
      const result = await resolveTrialMembership(membershipId, { action });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          action === "commit"
            ? `${studentName} committed to the group`
            : `${studentName} — trial ended`,
        );
        setOpen(false);
      }
    });
  }

  const isGroup = groupType === "GROUP";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Resolve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Trial — {studentName}</DialogTitle>
          <DialogDescription>
            Choose whether this student will commit to the group or didn&apos;t
            continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Billing preview:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              Commit:{" "}
              {isGroup
                ? "First lesson is free (100% discount)"
                : "First lesson at 50% discount"}
            </li>
            <li>
              Didn&apos;t continue:{" "}
              {isGroup
                ? "No billing — group trials are free"
                : "Billing will be created for attended lessons at 50% discount"}
            </li>
          </ul>
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => handleAction("didnt_continue")}
            disabled={isPending || !hasAttendance}
            title={
              !hasAttendance
                ? "Attendance must be recorded before marking as didn't continue"
                : undefined
            }
          >
            {isPending ? "..." : "Didn't continue"}
          </Button>
          <Button
            onClick={() => handleAction("commit")}
            disabled={isPending}
          >
            {isPending ? "..." : "Commit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
