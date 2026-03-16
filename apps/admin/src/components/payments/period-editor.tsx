"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adjustPeriod } from "@/lib/actions/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

interface PeriodEditorProps {
  periodId: string;
  studentName: string;
  groupPublicId: string;
  periodLabel: string;
  totalLessons: number;
  amountDue: number;
  discountAmount: number;
}

export function PeriodEditor({
  periodId,
  studentName,
  groupPublicId,
  periodLabel,
  totalLessons,
  amountDue,
  discountAmount,
}: PeriodEditorProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    totalLessons: String(totalLessons),
    amountDue: String(amountDue),
    discountAmount: String(discountAmount),
    reason: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await adjustPeriod(periodId, {
        totalLessons: Number(form.totalLessons),
        amountDue: Number(form.amountDue),
        discountAmount: Number(form.discountAmount),
        reason: form.reason,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Billing period adjusted for ${studentName}`);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) {
        setForm({
          totalLessons: String(totalLessons),
          amountDue: String(amountDue),
          discountAmount: String(discountAmount),
          reason: "",
        });
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust Billing Period</DialogTitle>
            <DialogDescription>
              {studentName} · {groupPublicId} · {periodLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totalLessons">Total Lessons</Label>
              <Input
                id="totalLessons"
                type="number"
                value={form.totalLessons}
                onChange={(e) => setForm((f) => ({ ...f, totalLessons: e.target.value }))}
                min={0}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amountDue">Amount Due (UZS)</Label>
              <Input
                id="amountDue"
                type="number"
                value={form.amountDue}
                onChange={(e) => setForm((f) => ({ ...f, amountDue: e.target.value }))}
                min={0}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountAmount">Discount (UZS)</Label>
              <Input
                id="discountAmount"
                type="number"
                value={form.discountAmount}
                onChange={(e) => setForm((f) => ({ ...f, discountAmount: e.target.value }))}
                min={0}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for adjustment</Label>
              <Input
                id="reason"
                placeholder="e.g., billing error correction"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                required
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !form.reason}>
              {isPending ? "Saving..." : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
