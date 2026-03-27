"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { processRefund } from "@/lib/actions/refunds";
import type { RefundRow } from "@/lib/queries/refunds";
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
import { Banknote } from "lucide-react";

interface ProcessRefundDialogProps {
  refund: RefundRow;
}

export function ProcessRefundDialog({ refund }: ProcessRefundDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(refund.amount));
  const [method, setMethod] = useState<string>("");
  const [note, setNote] = useState("");

  function handleProcess() {
    startTransition(async () => {
      const result = await processRefund({
        refundId: refund.id,
        amountRefunded: Number(amount),
        paymentMethod: method,
        note: note || null,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Refund processed successfully");
        setOpen(false);
      }
    });
  }

  function resetForm() {
    setAmount(String(refund.amount));
    setMethod("");
    setNote("");
  }

  const canSubmit = Number(amount) > 0 && method;

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
          <Banknote className="mr-1 size-3.5" />
          Process
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
          <DialogDescription>
            {refund.student.firstName} {refund.student.lastName} —{" "}
            {refund.amount.toLocaleString("en-US")} UZS
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount to Refund</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select method..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="click">Click</SelectItem>
                <SelectItem value="payme">Payme</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
          <Button onClick={handleProcess} disabled={!canSubmit || isPending}>
            {isPending ? "Processing..." : "Process Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
