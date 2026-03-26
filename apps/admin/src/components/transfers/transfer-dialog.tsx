"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { transferStudent, getTransferBillingPreview } from "@/lib/actions/transfers";
import type { TransferReason, TransferGroup } from "@/lib/queries/transfers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowRightLeft, Check } from "lucide-react";
import { DAYS_LABEL, LEVEL_SHORT, STAGE_SHORT } from "@/lib/constants";

interface TransferDialogProps {
  membershipId: string;
  studentName: string;
  currentGroupPublicId: string;
  transferReasons: TransferReason[];
  availableGroups: TransferGroup[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type BillingPreview = Awaited<ReturnType<typeof getTransferBillingPreview>>;

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US") + " UZS";
}

export function TransferDialog({
  membershipId,
  studentName,
  currentGroupPublicId,
  transferReasons,
  availableGroups,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: TransferDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const isControlled = controlledOpen !== undefined;
  const [isPending, startTransition] = useTransition();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [reasonId, setReasonId] = useState<string>("");
  const [otherReason, setOtherReason] = useState("");
  const [search, setSearch] = useState("");
  const [billingPreview, setBillingPreview] = useState<BillingPreview>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const selectedReason = transferReasons.find((r) => r.id === reasonId);

  // Fetch billing preview when destination group is selected
  useEffect(() => {
    if (!selectedGroupId) {
      setBillingPreview(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

    getTransferBillingPreview(membershipId, selectedGroupId).then((result) => {
      if (!cancelled) {
        setBillingPreview(result);
        setPreviewLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [membershipId, selectedGroupId]);

  function handleTransfer() {
    startTransition(async () => {
      const result = await transferStudent({
        membershipId,
        destinationGroupId: selectedGroupId,
        transferReasonId: reasonId,
        otherTransferReason: selectedReason?.isOther ? otherReason : null,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        const credit = result.transferCredit;
        const refund = result.refundAmount;
        let msg = `${studentName} transferred successfully`;
        if (credit) msg += `. Transfer credit: ${formatUZS(credit)}`;
        if (refund) msg += `. Pending refund: ${formatUZS(refund)}`;
        toast.success(msg);
        if ("warning" in result && result.warning) {
          toast.warning(result.warning);
        }
        setOpen(false);
        resetForm();
      }
    });
  }

  function resetForm() {
    setSelectedGroupId("");
    setReasonId("");
    setOtherReason("");
    setSearch("");
    setBillingPreview(null);
  }

  function getDaysLabel(days: number[]) {
    const key = days.join(",");
    return DAYS_LABEL[key] ?? days.join(",");
  }

  // Filter groups by search
  const filteredGroups = availableGroups.filter((g) => {
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

  const canSubmit =
    selectedGroupId && reasonId && (!selectedReason?.isOther || otherReason.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <ArrowRightLeft className="mr-1 size-3.5" />
            Transfer
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer {studentName}</DialogTitle>
          <DialogDescription>
            From group {currentGroupPublicId}. Select a destination group and
            transfer reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group picker */}
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

          {/* Transfer reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Transfer Reason</label>
            <Select value={reasonId} onValueChange={setReasonId}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {transferReasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Other reason text */}
          {selectedReason?.isOther && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Specify Reason</label>
              <Textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Describe the transfer reason..."
                rows={2}
              />
            </div>
          )}

          {/* Billing preview */}
          {selectedGroupId && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Billing Impact</p>
              {previewLoading ? (
                <p className="text-muted-foreground text-sm">
                  Loading preview...
                </p>
              ) : billingPreview ? (
                <div className="space-y-2 text-sm">
                  {billingPreview.sourceAdjustment && (
                    <div>
                      <p className="text-muted-foreground">
                        Source ({billingPreview.sourceAdjustment.periodLabel}):
                      </p>
                      <p>
                        Lessons: {billingPreview.sourceAdjustment.previousTotalLessons}{" "}
                        → {billingPreview.sourceAdjustment.newTotalLessons}
                      </p>
                      <p>
                        Amount:{" "}
                        {formatUZS(billingPreview.sourceAdjustment.previousAmountDue)}{" "}
                        → {formatUZS(billingPreview.sourceAdjustment.newAmountDue)}
                      </p>
                    </div>
                  )}
                  {billingPreview.futurePeriodsCount > 0 && (
                    <p className="text-muted-foreground">
                      {billingPreview.futurePeriodsCount} future period
                      {billingPreview.futurePeriodsCount > 1 ? "s" : ""} will be
                      removed
                    </p>
                  )}
                  {billingPreview.overpayment > 0 && (
                    <p className="font-medium text-green-700">
                      Transfer credit: {formatUZS(billingPreview.overpayment)}
                    </p>
                  )}
                  {billingPreview.destinationPeriods.length > 0 && (
                    <div>
                      <p className="text-muted-foreground">
                        Destination periods:
                      </p>
                      {billingPreview.destinationPeriods.map((p) => (
                        <p key={p.periodLabel}>
                          {p.periodLabel}: {p.totalLessons} lessons,{" "}
                          {formatUZS(p.amountDue)}
                        </p>
                      ))}
                    </div>
                  )}
                  {!billingPreview.sourceAdjustment &&
                    billingPreview.futurePeriodsCount === 0 &&
                    billingPreview.overpayment === 0 && (
                      <p className="text-muted-foreground">
                        No billing adjustments needed
                      </p>
                    )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Could not load preview
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!canSubmit || isPending}>
            {isPending ? "Transferring..." : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
