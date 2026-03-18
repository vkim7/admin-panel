"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UnavailabilityForm } from "./unavailability-form";
import { deleteTeacherUnavailability } from "@/lib/actions/teacher-unavailability";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Trash2 } from "lucide-react";
import type { TeacherUnavailabilityRecord } from "@/lib/queries/lessons";

interface UnavailabilitySectionProps {
  teacherId: string;
  unavailabilities: TeacherUnavailabilityRecord[];
}

export function UnavailabilitySection({
  teacherId,
  unavailabilities,
}: UnavailabilitySectionProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Unavailability</h3>
        <UnavailabilityForm teacherId={teacherId} />
      </div>

      {unavailabilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recorded unavailability.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Time</th>
                <th className="px-3 py-2 text-left font-medium">Reason</th>
                <th className="px-3 py-2 text-left font-medium">Recorded By</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {unavailabilities.map((ua) => (
                <tr key={ua.id} className="border-t">
                  <td className="px-3 py-2 tabular-nums">
                    {ua.date.toLocaleDateString("en-GB", { timeZone: "UTC" })}
                  </td>
                  <td className="px-3 py-2">
                    {ua.startTime === null
                      ? "Whole day"
                      : `${ua.startTime}${ua.endTime ? ` – ${ua.endTime}` : "+"}`}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {ua.reason ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {ua.createdBy
                      ? `${ua.createdBy.firstName} ${ua.createdBy.lastName}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(ua.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationDialog
        open={deleteId !== null}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Unavailability"
        description="Remove this unavailability record? This will not automatically restore any pending lessons."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteId) return;
          const result = await deleteTeacherUnavailability(deleteId);
          if (result?.error) {
            toast.error(result.error);
          } else {
            toast.success("Unavailability deleted");
          }
          setDeleteId(null);
        }}
      />
    </div>
  );
}
