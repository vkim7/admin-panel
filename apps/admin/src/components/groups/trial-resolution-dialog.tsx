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
}

export function TrialResolutionDialog({
  membershipId,
  studentName,
}: TrialResolutionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAction(action: "commit" | "remove") {
    startTransition(async () => {
      const result = await resolveTrialMembership(membershipId, { action });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          action === "commit"
            ? `${studentName} committed to the group`
            : `${studentName} removed from the group`,
        );
        setOpen(false);
      }
    });
  }

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
            Choose whether this student will commit to the group or be removed.
            Committing will create billing periods from the original join date.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => handleAction("remove")}
            disabled={isPending}
          >
            {isPending ? "..." : "Remove"}
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
