"use client";

import { useTransition } from "react";
import { updateLeadStatus } from "@/lib/actions/leads";
import type { LeadStatus } from "@eng/database";

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: "NEW", label: "New", color: "text-blue-600" },
  { value: "CONTACTED", label: "Contacted", color: "text-amber-600" },
  { value: "TRIAL_SCHEDULED", label: "Trial Scheduled", color: "text-purple-600" },
  { value: "CONVERTED", label: "Converted", color: "text-green-600" },
  { value: "LOST", label: "Lost", color: "text-red-600" },
];

export function LeadStatusSelect({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: LeadStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as LeadStatus;
    if (newStatus === currentStatus) return;

    startTransition(async () => {
      await updateLeadStatus({ id: leadId, status: newStatus });
    });
  }

  const current = STATUS_OPTIONS.find((s) => s.value === currentStatus);

  return (
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
  );
}
