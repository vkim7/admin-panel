"use client";

import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { studentCancelLesson } from "@/lib/actions/lessons";

interface StudentCancelDialogProps {
  lessonId: string;
  cancellationsUsed: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentCancelDialog({
  lessonId,
  cancellationsUsed,
  open,
  onOpenChange,
}: StudentCancelDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Student Cancellation"
      description={`Cancel this lesson on student request. ${cancellationsUsed} of 2 monthly cancellations used. Requires 24h advance notice. A replacement lesson will be created at the end of the program.`}
      confirmLabel="Cancel Lesson"
      onConfirm={async () => {
        const result = await studentCancelLesson({ lessonId });
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success("Lesson cancelled on student request");
        }
      }}
    />
  );
}
