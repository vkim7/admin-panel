"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateTeacherPay } from "@/lib/actions/teacher-payments";
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

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface GeneratePayDialogProps {
  year: number;
  month: number;
  trigger?: React.ReactNode;
}

export function GeneratePayDialog({ year, month, trigger }: GeneratePayDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateTeacherPay({ year, month });
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.success) {
        const parts: string[] = [];
        if (result.created > 0) parts.push(`${result.created} records created`);
        if (result.skipped > 0) parts.push(`${result.skipped} skipped (already exist)`);
        toast.success(parts.join(", ") || "Generation complete");
        if (result.warnings && result.warnings.length > 0) {
          for (const w of result.warnings) {
            toast.warning(w);
          }
        }
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>Generate Pay</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Teacher Pay</DialogTitle>
          <DialogDescription>
            Generate payment records for all teachers with completed lessons in{" "}
            <strong>{MONTH_NAMES[month]} {year}</strong>. Existing records will be skipped.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isPending}>
            {isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
