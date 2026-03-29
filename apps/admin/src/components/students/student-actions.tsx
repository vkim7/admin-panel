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
import { deactivateStudent } from "@/lib/actions/students";

type LostReason = {
  id: string;
  name: string;
  isOther: boolean;
};

interface StudentActionsProps {
  studentId: string;
  status: string;
  lostReasons: LostReason[];
}

export function StudentActions({
  studentId,
  status,
  lostReasons,
}: StudentActionsProps) {
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedReason = lostReasons.find((r) => r.id === selectedReasonId);

  const showDeactivateButton =
    status === "ACTIVE" ||
    status === "AWAITING_ASSIGNMENT" ||
    status === "AWAITING_REASSIGNMENT";

  return (
    <>
      {/* Deactivate is a dangerous action — shown as muted link-style */}
      {showDeactivateButton && (
        <button
          type="button"
          onClick={() => setShowDeactivate(true)}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
        >
          Deactivate
        </button>
      )}

      <Dialog open={showDeactivate} onOpenChange={setShowDeactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Student</DialogTitle>
            <DialogDescription>
              This will remove the student from all active groups (with billing adjustment) and mark them as inactive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason for leaving</Label>
              <Select
                onValueChange={setSelectedReasonId}
                value={selectedReasonId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {lostReasons.map((r) => (
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
                  placeholder="Why is the student leaving?"
                  rows={2}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeactivate(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!selectedReasonId || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await deactivateStudent(studentId, {
                    lostReasonId: selectedReasonId,
                    otherLostReason: otherReason || null,
                  });
                  if (result?.error) {
                    toast.error(result.error);
                  } else if ("success" in result) {
                    toast.success("Student deactivated");
                    setShowDeactivate(false);
                  }
                });
              }}
            >
              {isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
