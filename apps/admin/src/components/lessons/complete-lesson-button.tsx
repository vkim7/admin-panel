"use client";

import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { completeLesson } from "@/lib/actions/lessons";

interface CompleteLessonDialogProps {
  lessonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompleteLessonDialog({
  lessonId,
  open,
  onOpenChange,
}: CompleteLessonDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Complete Lesson"
      description="Mark this lesson as completed. The active student count will be snapshotted for teacher pay calculation."
      confirmLabel="Complete"
      variant="default"
      onConfirm={async () => {
        const result = await completeLesson({ lessonId });
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success("Lesson completed");
        }
      }}
    />
  );
}
