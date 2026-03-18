"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignSubstitute } from "@/lib/actions/lessons";
import { UserCheck } from "lucide-react";

interface SubstitutePickerProps {
  lessonId: string;
  availableSubstitutes: { id: string; firstName: string; lastName: string }[];
}

export function SubstitutePicker({
  lessonId,
  availableSubstitutes,
}: SubstitutePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setOpen(false);
    setSelectedTeacherId("");
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserCheck className="mr-1 size-3.5" />
        Substitute
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Substitute Teacher</DialogTitle>
            <DialogDescription>
              Select a teacher to substitute for this lesson. Only available teachers are shown.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {availableSubstitutes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No available substitute teachers for this time slot.
              </p>
            ) : (
              <div className="space-y-2">
                <Select onValueChange={setSelectedTeacherId} value={selectedTeacherId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a teacher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubstitutes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button
              disabled={!selectedTeacherId || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await assignSubstitute({
                    lessonId,
                    substituteTeacherId: selectedTeacherId,
                  });
                  if (result?.error) {
                    toast.error(result.error);
                  } else {
                    toast.success("Substitute assigned");
                    handleClose();
                  }
                });
              }}
            >
              {isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
