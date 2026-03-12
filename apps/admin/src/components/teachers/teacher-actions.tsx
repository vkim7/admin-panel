"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deactivateTeacher } from "@/lib/actions/teachers";

export function TeacherActions({ teacherId }: { teacherId: string }) {
  const [showDeactivate, setShowDeactivate] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setShowDeactivate(true)}
      >
        Deactivate
      </Button>

      <ConfirmationDialog
        open={showDeactivate}
        onOpenChange={setShowDeactivate}
        title="Deactivate Teacher"
        description="This teacher will no longer appear in active lists. You must reassign their groups first."
        confirmLabel="Deactivate"
        onConfirm={async () => {
          const result = await deactivateTeacher(teacherId);
          if (result?.error) {
            toast.error(result.error);
          }
        }}
      />
    </>
  );
}
