"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { resolveTrialMembership, transferTrialStudent } from "@/lib/actions/group-memberships";
import { sendToReassignment, sendToLostList } from "@/lib/actions/students";
import type { TransferGroup } from "@/lib/queries/transfers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { DAYS_LABEL, LEVEL_SHORT, STAGE_SHORT } from "@/lib/constants";
import { EffectiveDatePicker } from "@/components/shared/effective-date-picker";
import { getUzbekistanTodayStr } from "@/lib/helpers/date";

type LostReason = {
  id: string;
  name: string;
  isOther: boolean;
};

interface TrialActionsMenuProps {
  membershipId: string;
  studentId: string;
  studentName: string;
  groupType: string;
  hasAttendance: boolean;
  lostReasons?: LostReason[];
  availableGroups?: TransferGroup[];
  currentGroupPublicId?: string;
}

export function TrialActionsMenu({
  membershipId,
  studentId,
  studentName,
  groupType,
  hasAttendance,
  lostReasons,
  availableGroups,
  currentGroupPublicId,
}: TrialActionsMenuProps) {
  const [isPending, startTransition] = useTransition();
  const [commitOpen, setCommitOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  // With-attendance lost (auto-reason via resolveTrialMembership)
  const [lostResolveOpen, setLostResolveOpen] = useState(false);
  // No-show lost (manual reason picker)
  const [lostManualOpen, setLostManualOpen] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  // Transfer trial
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [search, setSearch] = useState("");

  const isGroup = groupType === "GROUP";
  const selectedReason = lostReasons?.find((r) => r.id === selectedReasonId);
  const isFutureDate = effectiveDate > getUzbekistanTodayStr();

  function handleCommit() {
    startTransition(async () => {
      const result = await resolveTrialMembership(membershipId, { action: "commit" });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${studentName} committed to the group`);
        setCommitOpen(false);
      }
    });
  }

  function handleLostResolve() {
    startTransition(async () => {
      const result = await resolveTrialMembership(membershipId, { action: "didnt_continue" });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${studentName} sent to lost list`);
        setLostResolveOpen(false);
      }
    });
  }

  function handleLostManual() {
    startTransition(async () => {
      const result = await sendToLostList(studentId, membershipId, {
        lostReasonId: selectedReasonId,
        otherLostReason: otherReason || null,
        effectiveDate,
      });
      if (result?.error) {
        toast.error(result.error);
      } else if ("scheduled" in result && result.scheduled) {
        toast.success(`Lost list action for ${studentName} scheduled for ${effectiveDate}`);
        setLostManualOpen(false);
        setSelectedReasonId("");
        setOtherReason("");
        setEffectiveDate("");
      } else if ("success" in result) {
        toast.success(`${studentName} sent to lost list`);
        setLostManualOpen(false);
        setSelectedReasonId("");
        setOtherReason("");
        setEffectiveDate("");
      }
    });
  }

  function handleReassign() {
    startTransition(async () => {
      const result = await sendToReassignment(studentId, membershipId, effectiveDate || undefined);
      if (result?.error) {
        toast.error(result.error);
      } else if ("scheduled" in result && result.scheduled) {
        toast.success(`Reassignment for ${studentName} scheduled for ${effectiveDate}`);
        setReassignOpen(false);
        setEffectiveDate("");
      } else {
        toast.success(`${studentName} sent to reassignment`);
        setReassignOpen(false);
        setEffectiveDate("");
      }
    });
  }

  function handleTransfer() {
    startTransition(async () => {
      const result = await transferTrialStudent(membershipId, {
        destinationGroupId: selectedGroupId,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${studentName} transferred to new trial`);
        setTransferOpen(false);
        setSelectedGroupId("");
        setSearch("");
      }
    });
  }

  function getDaysLabel(days: number[]) {
    const key = days.join(",");
    return DAYS_LABEL[key] ?? days.join(",");
  }

  const filteredGroups = (availableGroups ?? []).filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const teacher = `${g.teacher.firstName} ${g.teacher.lastName}`;
    return (
      g.publicId.toLowerCase().includes(q) ||
      g.level.toLowerCase().includes(q) ||
      getDaysLabel(g.days).toLowerCase().includes(q) ||
      teacher.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {hasAttendance ? (
            <>
              <DropdownMenuItem onSelect={() => setCommitOpen(true)}>
                Commit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setLostResolveOpen(true)}>
                Send to Lost list
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setReassignOpen(true)}>
                Send to Reassignment
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {lostReasons && (
                <DropdownMenuItem onSelect={() => setLostManualOpen(true)}>
                  Send to Lost list
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setReassignOpen(true)}>
                Send to Reassignment
              </DropdownMenuItem>
              {availableGroups && currentGroupPublicId && (
                <DropdownMenuItem onSelect={() => setTransferOpen(true)}>
                  Transfer Trial
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Commit confirmation */}
      <Dialog open={commitOpen} onOpenChange={setCommitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commit — {studentName}</DialogTitle>
            <DialogDescription>
              {isGroup
                ? "First lesson is free (100% discount). Billing will be created for remaining lessons."
                : "First lesson at 50% discount. Billing will be created for remaining lessons."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCommit} disabled={isPending}>
              {isPending ? "..." : "Commit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Lost list (with attendance — auto reason) */}
      <Dialog open={lostResolveOpen} onOpenChange={setLostResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Lost list — {studentName}</DialogTitle>
            <DialogDescription>
              {isGroup
                ? "No billing — group trials are free. The student will be removed from this group."
                : "Billing will be created for attended lessons at 50% discount. The student will be removed from this group."}
              {" "}If they have no other active groups, they will be deactivated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostResolveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLostResolve} disabled={isPending}>
              {isPending ? "..." : "Send to Lost list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Lost list (no-show — manual reason picker) */}
      <Dialog
        open={lostManualOpen}
        onOpenChange={(v) => {
          setLostManualOpen(v);
          if (!v) {
            setSelectedReasonId("");
            setOtherReason("");
            setEffectiveDate("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Lost list — {studentName}</DialogTitle>
            <DialogDescription>
              This student will be removed from the group. If they have no other active groups, they will be deactivated.
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
                  {(lostReasons ?? []).map((r) => (
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

            <EffectiveDatePicker
              value={effectiveDate}
              onChange={setEffectiveDate}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLostManualOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!selectedReasonId || !effectiveDate || isPending}
              onClick={handleLostManual}
            >
              {isPending ? "..." : isFutureDate ? "Schedule Lost" : "Send to Lost list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Reassignment confirmation */}
      <Dialog
        open={reassignOpen}
        onOpenChange={(v) => {
          setReassignOpen(v);
          if (!v) setEffectiveDate("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Reassignment — {studentName}</DialogTitle>
            <DialogDescription>
              {studentName} will be removed from this group. If they have no other active groups, their status will change to Awaiting Reassignment.
            </DialogDescription>
          </DialogHeader>
          <EffectiveDatePicker
            value={effectiveDate}
            onChange={setEffectiveDate}
            disabled={isPending}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={!effectiveDate || isPending}>
              {isPending ? "..." : isFutureDate ? "Schedule Reassignment" : "Send to Reassignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Trial dialog */}
      <Dialog
        open={transferOpen}
        onOpenChange={(v) => {
          setTransferOpen(v);
          if (!v) {
            setSelectedGroupId("");
            setSearch("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Trial — {studentName}</DialogTitle>
            <DialogDescription>
              Move from {currentGroupPublicId} to another group for a new trial attempt. No billing adjustments — trials are free.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Destination Group</label>
            <Input
              placeholder="Search by group ID, level, teacher, days..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-60 space-y-1.5 overflow-y-auto">
              {filteredGroups.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No groups found
                </p>
              ) : (
                filteredGroups.map((g) => {
                  const isFull = g._count.memberships >= g.maxStudents;
                  const isSelected = selectedGroupId === g.id;
                  const activeCount = g._count.memberships;
                  const levelLabel = LEVEL_SHORT[g.level] ?? g.level;
                  const stageLabel = STAGE_SHORT[g.progressStage] ?? g.progressStage;

                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={isFull}
                      onClick={() => setSelectedGroupId(g.id)}
                      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : isFull
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-accent"
                      }`}
                    >
                      {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{g.publicId}</span>
                          <span className="text-xs font-medium text-foreground/70">
                            {levelLabel} · {stageLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {g.teacher.firstName} {g.teacher.lastName} · {activeCount}/{g.maxStudents}
                          </span>
                          <span>
                            {getDaysLabel(g.days)} {g.startTime}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={!selectedGroupId || isPending}>
              {isPending ? "Transferring..." : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
