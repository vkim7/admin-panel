"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { graduateGroup, getGraduationPreviewAction } from "@/lib/actions/group-graduation";
import type { LostReason } from "@/lib/queries/students";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GraduationCap, AlertTriangle } from "lucide-react";
import { LEVEL_LABEL, DAY_SHORT } from "@/lib/constants";

type GraduationPreview = Awaited<ReturnType<typeof getGraduationPreviewAction>>;

type StudentDecision = {
  studentId: string;
  decision: "CONTINUE" | "REASSIGN" | "DEACTIVATE";
  lostReasonId?: string;
  otherLostReason?: string;
};

interface GraduationDialogProps {
  groupId: string;
  groupPublicId: string;
  lostReasons: LostReason[];
}

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US") + " UZS";
}

export function GraduationDialog({
  groupId,
  groupPublicId,
  lostReasons,
}: GraduationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<GraduationPreview>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [decisions, setDecisions] = useState<Map<string, StudentDecision>>(new Map());

  // Load preview when dialog opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setPreviewLoading(true);

    getGraduationPreviewAction(groupId).then((result) => {
      if (!cancelled) {
        setPreview(result);
        setPreviewLoading(false);
        // Default all students to CONTINUE
        if (result && result.eligible) {
          const defaults = new Map<string, StudentDecision>();
          for (const s of result.students) {
            defaults.set(s.id, { studentId: s.id, decision: "CONTINUE" });
          }
          setDecisions(defaults);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [groupId, open]);

  function updateDecision(studentId: string, field: Partial<StudentDecision>) {
    setDecisions((prev) => {
      const next = new Map(prev);
      const current = next.get(studentId) ?? { studentId, decision: "CONTINUE" as const };
      next.set(studentId, { ...current, ...field });
      return next;
    });
  }

  function handleGraduate() {
    startTransition(async () => {
      const result = await graduateGroup({
        groupId,
        studentDecisions: [...decisions.values()],
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          `Group ${groupPublicId} graduated. ${result.continuingCount} student(s) continuing to new group.`,
        );
        setOpen(false);
        resetForm();
      }
    });
  }

  function resetForm() {
    setPreview(null);
    setDecisions(new Map());
  }

  const continuingCount = [...decisions.values()].filter((d) => d.decision === "CONTINUE").length;
  const reassignCount = [...decisions.values()].filter((d) => d.decision === "REASSIGN").length;
  const deactivateCount = [...decisions.values()].filter((d) => d.decision === "DEACTIVATE").length;

  // Validate: all DEACTIVATE decisions must have lostReasonId
  const allValid = [...decisions.values()].every(
    (d) => d.decision !== "DEACTIVATE" || (d.lostReasonId && d.lostReasonId.trim() !== ""),
  );

  const canSubmit = preview && "eligible" in preview && preview.eligible && decisions.size > 0 && allValid;

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
          <GraduationCap className="mr-1 size-4" />
          Graduate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Graduate {groupPublicId}</DialogTitle>
          <DialogDescription>
            Create a successor group at the next level and decide each student&apos;s path.
          </DialogDescription>
        </DialogHeader>

        {previewLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading graduation preview...
          </p>
        ) : !preview ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Could not load preview
          </p>
        ) : !preview.eligible ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />
            {preview.reason}
          </div>
        ) : (
          <div className="space-y-5">
            {/* New group preview */}
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">New Group Details</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Level:</span>{" "}
                  {preview.newGroup.levelLabel}
                </div>
                <div>
                  <span className="text-muted-foreground">Teacher:</span>{" "}
                  {preview.newGroup.teacher.firstName} {preview.newGroup.teacher.lastName}
                </div>
                <div>
                  <span className="text-muted-foreground">Schedule:</span>{" "}
                  {preview.newGroup.days.map((d: number) => DAY_SHORT[d]).join("/")} at{" "}
                  {preview.newGroup.startTime} ({preview.newGroup.durationMinutes} min)
                </div>
                <div>
                  <span className="text-muted-foreground">Period:</span>{" "}
                  {preview.newGroup.startDate} — {preview.newGroup.endDate}
                </div>
                <div>
                  <span className="text-muted-foreground">Lessons:</span>{" "}
                  {preview.newGroup.lessonCount}
                </div>
                <div>
                  <span className="text-muted-foreground">Price/lesson:</span>{" "}
                  {formatUZS(preview.newGroup.pricePerLesson)}
                </div>
              </div>
            </div>

            {/* Pending refund warning */}
            {preview.pendingRefundCount > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  {preview.pendingRefundCount} student(s) have pending refunds — resolve via{" "}
                  <a href="/refunds" className="font-medium underline">
                    Refunds page
                  </a>
                </span>
              </div>
            )}

            {/* Student decisions */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Student Decisions</p>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Student</th>
                      <th className="px-3 py-2 text-left font-medium">Decision</th>
                      <th className="px-3 py-2 text-left font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.students.map((s) => {
                      const d = decisions.get(s.id);
                      const isDeactivate = d?.decision === "DEACTIVATE";
                      const selectedReason = lostReasons.find((r) => r.id === d?.lostReasonId);

                      return (
                        <tr key={s.id} className="border-t">
                          <td className="px-3 py-2">
                            <span className="font-medium">{s.crmCode}</span>{" "}
                            {s.firstName} {s.lastName}
                            {s.pendingRefundAmount > 0 && (
                              <span className="ml-1 text-xs text-amber-600">
                                (refund: {formatUZS(s.pendingRefundAmount)})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={d?.decision ?? "CONTINUE"}
                              onValueChange={(v) =>
                                updateDecision(s.id, {
                                  decision: v as "CONTINUE" | "REASSIGN" | "DEACTIVATE",
                                  lostReasonId: undefined,
                                  otherLostReason: undefined,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CONTINUE">Continue</SelectItem>
                                <SelectItem value="REASSIGN">Reassign</SelectItem>
                                <SelectItem value="DEACTIVATE">Deactivate</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            {isDeactivate && (
                              <Select
                                value={d?.lostReasonId ?? ""}
                                onValueChange={(v) =>
                                  updateDecision(s.id, { lostReasonId: v })
                                }
                              >
                                <SelectTrigger className="h-8 w-[180px]">
                                  <SelectValue placeholder="Lost reason..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {lostReasons.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                      {r.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary footer */}
            <div className="flex gap-4 text-sm">
              <span className="text-green-700">{continuingCount} continuing</span>
              <span className="text-amber-700">{reassignCount} to reassignment</span>
              <span className="text-red-700">{deactivateCount} deactivating</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGraduate} disabled={!canSubmit || isPending}>
            {isPending ? "Graduating..." : "Graduate Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
