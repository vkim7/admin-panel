"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { convertRefundToCredit, getStudentPeriodsForCredit } from "@/lib/actions/refunds";
import type { RefundRow } from "@/lib/queries/refunds";
import { Button } from "@/components/ui/button";
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
import { Check, ArrowRightLeft } from "lucide-react";

type CreditPeriod = Awaited<ReturnType<typeof getStudentPeriodsForCredit>>[number];

interface ConvertToCreditDialogProps {
  refund: RefundRow;
}

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US") + " UZS";
}

export function ConvertToCreditDialog({ refund }: ConvertToCreditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [periods, setPeriods] = useState<CreditPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [note, setNote] = useState("");

  // Load available periods when dialog opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setPeriodsLoading(true);

    getStudentPeriodsForCredit(refund.id).then((result) => {
      if (!cancelled) {
        setPeriods(result);
        setPeriodsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refund.id, open]);

  function handleConvert() {
    startTransition(async () => {
      const result = await convertRefundToCredit({
        refundId: refund.id,
        targetPeriodId: selectedPeriodId,
        note: note || null,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Refund converted to credit successfully");
        setOpen(false);
      }
    });
  }

  function resetForm() {
    setSelectedPeriodId("");
    setNote("");
    setPeriods([]);
  }

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
          <ArrowRightLeft className="mr-1 size-3.5" />
          To Credit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Credit</DialogTitle>
          <DialogDescription>
            Apply {formatUZS(refund.amount)} as credit to an unpaid period for{" "}
            {refund.student.firstName} {refund.student.lastName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {periodsLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading periods...
            </p>
          ) : periods.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No unpaid or partially paid periods available
            </p>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Period</label>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {periods.map((p) => {
                  const isSelected = selectedPeriodId === p.id;
                  const effectiveDue = p.amountDue - p.discountAmount;
                  const remaining = effectiveDue - p.amountPaid;
                  const periodLabel = `${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}`;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPeriodId(p.id)}
                      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      }`}
                    >
                      {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {periodLabel} · {p.group.publicId}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatUZS(remaining)} remaining
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Note (optional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={!selectedPeriodId || isPending}
          >
            {isPending ? "Converting..." : "Convert to Credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
