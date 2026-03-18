"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { completeLesson } from "@/lib/actions/lessons";
import { Check } from "lucide-react";

interface CompleteLessonButtonProps {
  lessonId: string;
}

export function CompleteLessonButton({ lessonId }: CompleteLessonButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Check className="mr-1 size-3.5" />
        Complete
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
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
    </>
  );
}
