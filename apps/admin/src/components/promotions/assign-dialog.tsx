"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignPromotionToStudent } from "@/lib/actions/promotions";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type Promotion = {
  id: string;
  name: string;
  type: string;
  discountType: string;
  discountPercent: number | null;
  discountAmount: number | null;
};

interface AssignDialogProps {
  studentId: string;
  promotions: Promotion[];
}

export function AssignPromotionDialog({ studentId, promotions }: AssignDialogProps) {
  const [open, setOpen] = useState(false);
  const [promotionId, setPromotionId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!promotionId) return;
    startTransition(async () => {
      const result = await assignPromotionToStudent({ studentId, promotionId });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Promotion assigned");
        setOpen(false);
        setPromotionId("");
      }
    });
  }

  function formatDiscount(p: Promotion) {
    if (p.discountType === "PERCENTAGE") return `${p.discountPercent}%`;
    return `${(p.discountAmount ?? 0).toLocaleString()} UZS`;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPromotionId(""); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 size-4" />
          Add Promotion
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Promotion</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={promotionId} onValueChange={setPromotionId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a promotion" />
            </SelectTrigger>
            <SelectContent>
              {promotions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({formatDiscount(p)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!promotionId || isPending}>
              {isPending ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
