"use client";

import { useState, useTransition } from "react";
import { updateLeadStatus } from "@/lib/actions/leads";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { LeadStatus } from "@eng/database";

type SelectableStatus = Exclude<LeadStatus, "CONVERTED">;

const STATUS_OPTIONS: { value: SelectableStatus; label: string; color: string }[] = [
  { value: "NEW", label: "New", color: "text-blue-600" },
  { value: "CONTACTED", label: "Contacted", color: "text-amber-600" },
  { value: "LOST", label: "Lost", color: "text-slate-600" },
];

export function LeadStatusSelect({
  leadId,
  currentStatus,
}: {
  leadId: string;
  // CONVERTED is never reached at runtime — the table renders a static badge
  // for the Converted tab. Prop type matches the upstream LeadStatus for ergonomics.
  currentStatus: LeadStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingLost, setPendingLost] = useState(false);

  function commit(newStatus: SelectableStatus) {
    startTransition(async () => {
      await updateLeadStatus({ id: leadId, status: newStatus });
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as SelectableStatus;
    if (newStatus === currentStatus) return;

    if (newStatus === "LOST") {
      // Destructive — confirm first. The <select> is controlled by currentStatus,
      // so if the user cancels, it snaps back automatically (no extra state).
      setPendingLost(true);
      return;
    }

    commit(newStatus);
  }

  const current = STATUS_OPTIONS.find((s) => s.value === currentStatus);

  return (
    <>
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className={`rounded border px-2 py-1 text-xs font-semibold bg-transparent focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 ${current?.color ?? ""}`}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ConfirmationDialog
        open={pendingLost}
        onOpenChange={setPendingLost}
        title="Mark this lead as lost?"
        description="The lead will move to the Lost tab. You can recover it from there if you change your mind."
        confirmLabel="Mark as Lost"
        variant="destructive"
        onConfirm={() => commit("LOST")}
      />
    </>
  );
}
