"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { mergeGroup, getMergeBillingPreview } from "@/lib/actions/group-merge";
import type { MergeGroup } from "@/lib/queries/group-merge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Merge, Check, AlertTriangle } from "lucide-react";
import { DAYS_LABEL, LEVEL_SHORT, STAGE_SHORT } from "@/lib/constants";

interface MergeDialogProps {
  sourceGroupId: string;
  sourceGroupPublicId: string;
  activeStudentCount: number;
  availableGroups: MergeGroup[];
}

type BillingPreview = Awaited<ReturnType<typeof getMergeBillingPreview>>;

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US") + " UZS";
}

export function MergeDialog({
  sourceGroupId,
  sourceGroupPublicId,
  activeStudentCount,
  availableGroups,
}: MergeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [billingPreview, setBillingPreview] = useState<BillingPreview>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Fetch billing preview when destination selected
  useEffect(() => {
    if (!selectedGroupId) {
      setBillingPreview(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setConfirmed(false);

    getMergeBillingPreview(sourceGroupId, selectedGroupId).then((result) => {
      if (!cancelled) {
        setBillingPreview(result);
        setPreviewLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sourceGroupId, selectedGroupId]);

  function handleMerge() {
    startTransition(async () => {
      const result = await mergeGroup({
        sourceGroupId,
        destinationGroupId: selectedGroupId,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          `Group ${sourceGroupPublicId} merged successfully. ${result.movedCount} student(s) moved.`,
        );
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
    setSearch("");
    setBillingPreview(null);
    setConfirmed(false);
  }

  function getDaysLabel(days: number[]) {
    const key = days.join(",");
    return DAYS_LABEL[key] ?? days.join(",");
  }

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

  const selectedGroup = availableGroups.find((g) => g.id === selectedGroupId);
  const hasCapacity = selectedGroup
    ? selectedGroup._count.memberships + activeStudentCount <= selectedGroup.maxStudents
    : false;

  const canSubmit = selectedGroupId && hasCapacity && confirmed;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Merge className="mr-1 size-4" />
          Merge
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {sourceGroupPublicId}</DialogTitle>
          <DialogDescription>
            Move all {activeStudentCount} active student(s) to another group.
            The source group will be closed.
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
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No same-level groups available
                </p>
              ) : (
                filteredGroups.map((g) => {
                  const capacity = g._count.memberships + activeStudentCount <= g.maxStudents;
                  const isSelected = selectedGroupId === g.id;
                  const activeCount = g._count.memberships;
                  const levelLabel = LEVEL_SHORT[g.level] ?? g.level;
                  const stageLabel = STAGE_SHORT[g.progressStage] ?? g.progressStage;

                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={!capacity}
                      onClick={() => setSelectedGroupId(g.id)}
                      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : !capacity
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
                            {!capacity && " (not enough capacity)"}
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

          {/* Billing preview */}
          {selectedGroupId && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Billing Impact</p>
              {previewLoading ? (
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              ) : billingPreview ? (
                <div className="space-y-2 text-sm">
                  {billingPreview.students.map((s) => (
                    <div key={s.studentId} className="border-b pb-2 last:border-0 last:pb-0">
                      <p className="font-medium">
                        {s.crmCode} — {s.firstName} {s.lastName}
                      </p>
                      {s.sourceAdjustment && (
                        <p className="text-muted-foreground">
                          Source: {formatUZS(s.sourceAdjustment.previousAmountDue)} → {formatUZS(s.sourceAdjustment.newAmountDue)}
                        </p>
                      )}
                      {s.overpayment > 0 && (
                        <p className="text-green-700">
                          Credit: {formatUZS(s.overpayment)}
                        </p>
                      )}
                    </div>
                  ))}
                  {billingPreview.totalOverpayment > 0 && (
                    <p className="pt-1 font-medium text-green-700">
                      Total credit: {formatUZS(billingPreview.totalOverpayment)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Could not load preview</p>
              )}
            </div>
          )}

          {/* Confirmation */}
          {selectedGroupId && selectedGroup && !previewLoading && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <div className="space-y-2">
                <p className="text-sm text-red-800">
                  This will close <strong>{sourceGroupPublicId}</strong> and move {activeStudentCount} student(s) to{" "}
                  <strong>{selectedGroup.publicId}</strong>. This cannot be undone.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="rounded"
                  />
                  I understand and want to proceed
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleMerge}
            disabled={!canSubmit || isPending}
          >
            {isPending ? "Merging..." : "Merge Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
