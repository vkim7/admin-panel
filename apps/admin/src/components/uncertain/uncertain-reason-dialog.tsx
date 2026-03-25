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
import { markUncertain } from "@/lib/actions/students";

type UncertainReasonOption = {
  id: string;
  name: string;
  isOther: boolean;
};

interface UncertainReasonDialogProps {
  studentId: string;
  studentName: string;
  uncertainReasons: UncertainReasonOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UncertainReasonDialog({
  studentId,
  studentName,
  uncertainReasons,
  open,
  onOpenChange,
}: UncertainReasonDialogProps) {
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedReason = uncertainReasons.find((r) => r.id === selectedReasonId);

  function handleOpenChange(v: boolean) {
    onOpenChange(v);
    if (!v) {
      setSelectedReasonId("");
      setOtherReason("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Uncertain</DialogTitle>
          <DialogDescription>
            Flag {studentName} as uncertain. Select a reason below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select onValueChange={setSelectedReasonId} value={selectedReasonId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {uncertainReasons.map((r) => (
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
                placeholder="What makes you think this student is uncertain?"
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedReasonId || isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await markUncertain(studentId, {
                  uncertainReasonId: selectedReasonId,
                  otherReason: otherReason || null,
                });
                if (result?.error) {
                  toast.error(result.error);
                } else {
                  toast.success(`${studentName} marked as uncertain`);
                  handleOpenChange(false);
                }
              });
            }}
          >
            {isPending ? "..." : "Mark as Uncertain"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
