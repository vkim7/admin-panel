"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { studentCancelLesson } from "@/lib/actions/lessons";
import { UserX } from "lucide-react";

interface StudentCancelDialogProps {
  lessonId: string;
  cancellationsUsed: number;
}

export function StudentCancelDialog({
  lessonId,
  cancellationsUsed,
}: StudentCancelDialogProps) {
  const [open, setOpen] = useState(false);
  const remaining = 2 - cancellationsUsed;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={remaining <= 0}
      >
        <UserX className="mr-1 size-3.5" />
        Student Cancel
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
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
    </>
  );
}
