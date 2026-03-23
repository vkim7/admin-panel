"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordPayment } from "@/lib/actions/payments";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RecordPaymentDialogProps {
  periodId: string;
  studentName: string;
  amountDue: number;
  discountAmount: number;
  amountPaid: number;
  trigger?: React.ReactNode;
}

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US");
}

export function RecordPaymentDialog({
  periodId,
  studentName,
  amountDue,
  discountAmount,
  amountPaid,
  trigger,
}: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const remaining = amountDue - discountAmount - amountPaid;
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<string>("");
  const [note, setNote] = useState("");

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setAmount(String(amountDue - discountAmount - amountPaid));
      setMethod("");
      setNote("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !method) return;

    startTransition(async () => {
      const result = await recordPayment(periodId, {
        amount: Number(amount),
        paymentMethod: method,
        note: note || null,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Payment of ${formatUZS(Number(amount))} UZS recorded for ${studentName}`);
        setOpen(false);
        setAmount(String(remaining));
        setMethod("");
        setNote("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">Record</Button>}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record Payment — {studentName}</DialogTitle>
            <DialogDescription>
              Due: {formatUZS(amountDue)} UZS
              {discountAmount > 0 && ` (discount: ${formatUZS(discountAmount)})`}
              {" · "}Paid: {formatUZS(amountPaid)} UZS
              {" · "}Remaining: {formatUZS(remaining)} UZS
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (UZS)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                max={remaining}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select value={method} onValueChange={setMethod} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="click">Click</SelectItem>
                  <SelectItem value="payme">Payme</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Input
                id="note"
                placeholder="e.g., paid by uncle"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">Optional</p>
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
            <Button type="submit" disabled={isPending || !amount || !method}>
              {isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
