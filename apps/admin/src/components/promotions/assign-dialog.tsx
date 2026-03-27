"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignPromotionToStudent } from "@/lib/actions/promotions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setPromotionId("");
      setComment("");
    }
  }

  function handleSubmit() {
    if (!promotionId || !comment.trim()) return;
    startTransition(async () => {
      const result = await assignPromotionToStudent({ studentId, promotionId, comment: comment.trim() });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Promotion assigned");
        setOpen(false);
        setPromotionId("");
        setComment("");
      }
    });
  }

  function formatDiscount(p: Promotion) {
    if (p.discountType === "PERCENTAGE") return `${p.discountPercent}%`;
    return `${(p.discountAmount ?? 0).toLocaleString()} UZS`;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 size-4" />
          Add Promotion
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Promotion</DialogTitle>
          <DialogDescription className="sr-only">
            Select a promotion and provide a reason for assigning it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Promotion</Label>
            <Select value={promotionId} onValueChange={setPromotionId}>
              <SelectTrigger className="w-full">
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
          </div>
          <div className="space-y-2">
            <Label>
              Reason <span className="text-muted-foreground font-normal">(required)</span>
            </Label>
            <Textarea
              placeholder="Reason for this promotion..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!promotionId || !comment.trim() || isPending}>
              {isPending ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
