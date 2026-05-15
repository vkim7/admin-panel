"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { markLeadLost } from "@/lib/actions/leads";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LeadLostReason } from "@eng/database";

const REASONS: { value: LeadLostReason; label: string }[] = [
  { value: "NO_ANSWER", label: "No answer (after retries)" },
  { value: "WRONG_NUMBER", label: "Wrong number / doesn't exist" },
  { value: "DIDNT_SUBMIT", label: "Didn't submit (spam / accidental)" },
  { value: "AGE_OUT_OF_RANGE", label: "Kid — out of age range" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "WANTED_OFFLINE", label: "Wanted offline" },
  { value: "DUPLICATE", label: "Duplicate submission" },
  { value: "OTHER", label: "Other" },
];

export function MarkAsLostDialog({
  leadId,
  open,
  onOpenChange,
  onSuccess,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [reason, setReason] = useState<LeadLostReason | null>(null);
  const [otherText, setOtherText] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setReason(null);
    setOtherText("");
  }

  function handleSubmit() {
    if (!reason) return;
    if (reason === "OTHER" && otherText.trim().length === 0) return;

    startTransition(async () => {
      const result = await markLeadLost({
        id: leadId,
        reason,
        otherText: reason === "OTHER" ? otherText : null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Lead marked as lost");
      reset();
      onOpenChange(false);
      onSuccess?.();
    });
  }

  const canSubmit =
    reason !== null &&
    (reason !== "OTHER" || otherText.trim().length > 0) &&
    !isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why was this lead lost?</DialogTitle>
          <DialogDescription>
            Pick the closest reason. This is recorded for reporting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name="lost-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="size-4"
              />
              <span className="text-sm">{r.label}</span>
            </label>
          ))}

          {reason === "OTHER" && (
            <div className="pt-2 space-y-1.5">
              <Label htmlFor="lost-other">Describe the reason</Label>
              <Textarea
                id="lost-other"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Free-text reason..."
                rows={2}
                maxLength={500}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending ? "Marking..." : "Mark as Lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
