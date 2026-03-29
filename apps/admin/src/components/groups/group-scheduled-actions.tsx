"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { GroupScheduledActionRow } from "@/lib/queries/scheduled-actions";
import { cancelScheduledAction } from "@/lib/actions/scheduled-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TYPE_LABELS: Record<string, string> = {
  TRANSFER: "Transfer",
  SEND_TO_REASSIGNMENT: "Reassignment",
  SEND_TO_LOST: "Lost List",
  DEACTIVATE: "Deactivate",
  MERGE_GROUP: "Merge",
  ASSIGN: "Assignment",
  CHANGE_TEACHER: "Teacher Change",
};

interface GroupScheduledActionsProps {
  actions: GroupScheduledActionRow[];
  groupId: string;
}

function getDirection(
  action: GroupScheduledActionRow,
  groupId: string,
): "in" | "out" | null {
  if (action.type === "CHANGE_TEACHER") return null;
  if (action.destGroupId === groupId) return "in";
  return "out";
}

export function GroupScheduledActions({
  actions,
  groupId,
}: GroupScheduledActionsProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (actions.length === 0) return null;

  const actionToCancel = actions.find((a) => a.id === cancellingId);

  function handleCancel() {
    if (!cancellingId) return;
    startTransition(async () => {
      const result = await cancelScheduledAction({
        id: cancellingId,
        cancelReason: null,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Scheduled action cancelled");
      }
      setCancellingId(null);
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">Scheduled</h3>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Student</th>
              <th className="px-3 py-2 text-left font-medium">Action</th>
              <th className="px-3 py-2 text-left font-medium">Direction</th>
              <th className="px-3 py-2 text-left font-medium">
                Source / Destination
              </th>
              <th className="px-3 py-2 text-left font-medium">
                Effective Date
              </th>
              <th className="px-3 py-2 text-left font-medium">Created By</th>
              <th className="px-3 py-2 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => {
              const direction = getDirection(action, groupId);
              const otherGroup =
                direction === "in" ? action.sourceGroup : action.destGroup;

              return (
                <tr key={action.id} className="border-t">
                  <td className="px-3 py-2">
                    {action.student ? (
                      <Link
                        href={`/students/${action.student.id}`}
                        className="text-primary hover:underline"
                      >
                        {action.student.firstName} {action.student.lastName}
                      </Link>
                    ) : action.type === "MERGE_GROUP" ? (
                      <span className="text-muted-foreground">
                        All students
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {TYPE_LABELS[action.type] ?? action.type}
                  </td>
                  <td className="px-3 py-2">
                    {direction === "in" ? (
                      <span className="text-green-600">↑ Arriving</span>
                    ) : direction === "out" ? (
                      <span className="text-red-600">↓ Leaving</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {action.type === "CHANGE_TEACHER" ? (
                      <span className="text-muted-foreground">
                        {(action.payload as Record<string, string>)?.currentTeacherName} → {(action.payload as Record<string, string>)?.newTeacherName}
                      </span>
                    ) : otherGroup ? (
                      <Link
                        href={`/groups/${otherGroup.id}`}
                        className="text-primary hover:underline"
                      >
                        {direction === "in" ? "from " : "to "}
                        {otherGroup.publicId}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(action.effectiveDate).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {action.createdBy.firstName} {action.createdBy.lastName}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setCancellingId(action.id)}
                    >
                      Cancel
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog
        open={!!cancellingId}
        onOpenChange={(open) => {
          if (!open) setCancellingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Scheduled Action</DialogTitle>
            <DialogDescription>
              {actionToCancel && (
                <>
                  Cancel the scheduled{" "}
                  {TYPE_LABELS[actionToCancel.type]?.toLowerCase() ??
                    actionToCancel.type}{" "}
                  {actionToCancel.student &&
                    `for ${actionToCancel.student.firstName} ${actionToCancel.student.lastName} `}
                  on{" "}
                  {new Date(actionToCancel.effectiveDate).toLocaleDateString(
                    "en-GB",
                  )}
                  ?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancellingId(null)}
              disabled={isPending}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending}
            >
              {isPending ? "Cancelling..." : "Cancel Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
