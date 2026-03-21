"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { AlertTriangle, UserMinus } from "lucide-react";
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { sendToReassignment, deactivateStudent } from "@/lib/actions/students";
import { LEVEL_SHORT } from "@/lib/constants";

type OrphanedStudent = {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  level: string;
};

type LostReason = {
  id: string;
  name: string;
  isOther: boolean;
};

interface OrphanWarningProps {
  orphans: OrphanedStudent[];
  lostReasons: LostReason[];
}

export function OrphanWarning({ orphans, lostReasons }: OrphanWarningProps) {
  const [reassignStudent, setReassignStudent] = useState<OrphanedStudent | null>(null);
  const [deactivatingStudent, setDeactivatingStudent] = useState<OrphanedStudent | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedReason = lostReasons.find((r) => r.id === selectedReasonId);

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <AlertTriangle className="size-4" />
        Orphaned Students ({orphans.length})
      </div>
      <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
        These students are marked as ACTIVE but have no active group membership. They need to be reassigned or deactivated.
      </p>

      <div className="space-y-2">
        {orphans.map((student) => (
          <div
            key={student.id}
            className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2 dark:border-amber-800 dark:bg-amber-950/50"
          >
            <div className="flex items-center gap-3 text-sm">
              <span className="font-mono text-muted-foreground">{student.crmCode}</span>
              <Link
                href={`/students/${student.id}`}
                className="font-medium text-primary hover:underline"
              >
                {student.firstName} {student.lastName}
              </Link>
              <span className="text-muted-foreground">
                {LEVEL_SHORT[student.level] ?? student.level}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReassignStudent(student)}
              >
                Send to Reassignment
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setDeactivatingStudent(student);
                  setSelectedReasonId("");
                  setOtherReason("");
                }}
              >
                <UserMinus className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {reassignStudent && (
        <ConfirmationDialog
          open={!!reassignStudent}
          onOpenChange={(open) => {
            if (!open) setReassignStudent(null);
          }}
          title="Send to Reassignment"
          description={`${reassignStudent.firstName} ${reassignStudent.lastName} will be moved to AWAITING_REASSIGNMENT status and appear in the reassignment list below.`}
          confirmLabel="Send to Reassignment"
          variant="default"
          onConfirm={async () => {
            const result = await sendToReassignment(reassignStudent.id);
            if (result?.error) {
              toast.error(result.error);
            } else {
              toast.success(`${reassignStudent.firstName} sent to reassignment`);
            }
          }}
        />
      )}

      <Dialog
        open={!!deactivatingStudent}
        onOpenChange={(open) => {
          if (!open) setDeactivatingStudent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Student</DialogTitle>
            <DialogDescription>
              This will mark {deactivatingStudent?.firstName} {deactivatingStudent?.lastName} as inactive. Please select a reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason for leaving</Label>
              <Select onValueChange={setSelectedReasonId} value={selectedReasonId}>
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
            <Button variant="outline" onClick={() => setDeactivatingStudent(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!selectedReasonId || isPending}
              onClick={() => {
                if (!deactivatingStudent) return;
                startTransition(async () => {
                  const result = await deactivateStudent(deactivatingStudent.id, {
                    lostReasonId: selectedReasonId,
                    otherLostReason: otherReason || null,
                  });
                  if (result?.error) {
                    toast.error(result.error);
                  } else if ("success" in result) {
                    toast.success("Student deactivated");
                    setDeactivatingStudent(null);
                  }
                });
              }}
            >
              {isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
