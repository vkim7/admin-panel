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
import { deactivateStudent, reactivateStudent } from "@/lib/actions/students";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

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
  const [showReactivate, setShowReactivate] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedReason = lostReasons.find((r) => r.id === selectedReasonId);

  if (status === "INACTIVE") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowReactivate(true)}
        >
          Reactivate
        </Button>
        <ConfirmationDialog
          open={showReactivate}
          onOpenChange={setShowReactivate}
          title="Reactivate Student"
          description="This student will be set back to 'Awaiting Assignment' and can be assigned to a new group."
          confirmLabel="Reactivate"
          onConfirm={async () => {
            const result = await reactivateStudent(studentId);
            if (result?.error) {
              toast.error(result.error);
            } else {
              toast.success("Student reactivated");
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setShowDeactivate(true)}
      >
        Deactivate
      </Button>

      <Dialog open={showDeactivate} onOpenChange={setShowDeactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Student</DialogTitle>
            <DialogDescription>
              This will mark the student as inactive. Please select a reason.
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
