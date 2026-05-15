"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { updateLeadStatus } from "@/lib/actions/leads";
import { telegramLink } from "@/lib/helpers/contact-links";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { MarkAsLostDialog } from "./mark-as-lost-dialog";
import type { UrgencyInfo } from "@/lib/helpers/lead-staleness";
import type { LeadStatus, SelfAssessedLevel } from "@eng/database";

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  LOST: "Lost",
};

const STATUS_PILL: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-amber-100 text-amber-700",
  CONVERTED: "bg-green-100 text-green-700",
  LOST: "bg-slate-100 text-slate-600",
};

const URGENCY_PILL: Record<UrgencyInfo["tier"], string> = {
  red: "bg-red-100 text-red-800",
  green: "bg-green-100 text-green-800",
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  idle: "bg-muted text-muted-foreground",
};

const LEVEL_LABELS: Record<SelfAssessedLevel, string> = {
  COMPLETE_BEGINNER: "Beginner",
  CONTINUING: "Continuing",
};

export function LeadDrawerHeader({
  leadId,
  firstName,
  lastName,
  phone,
  language,
  selfAssessedLevel,
  status,
  urgency,
  onChange,
}: {
  leadId: string;
  firstName: string;
  lastName: string;
  phone: string;
  language: string;
  selfAssessedLevel: SelfAssessedLevel | null;
  status: LeadStatus;
  urgency: UrgencyInfo;
  onChange?: () => Promise<void> | void;
}) {
  const [lostOpen, setLostOpen] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [, startTransition] = useTransition();

  async function undoLost() {
    startTransition(async () => {
      const result = await updateLeadStatus({ id: leadId, status: "CONTACTED" });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Restored to Contacted");
      await onChange?.();
    });
  }

  const meta = [
    phone,
    language.toUpperCase(),
    selfAssessedLevel ? LEVEL_LABELS[selfAssessedLevel] : null,
  ].filter(Boolean);

  return (
    <div className="border-b p-4 space-y-3 pr-8">
      <div className="space-y-1.5">
        {urgency.chip ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_PILL[urgency.tier]}`}
          >
            {urgency.chip.label}
          </span>
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[status]}`}
          >
            {STATUS_LABELS[status]}
          </span>
        )}
        <div className="font-semibold text-lg leading-tight">
          {firstName} {lastName}
        </div>
        <div className="text-sm text-muted-foreground">{meta.join(" · ")}</div>
      </div>

      <div className="flex items-center gap-3">
        <a
          href={telegramLink(phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <Send className="size-4" />
          Telegram
        </a>

        {status !== "CONVERTED" && status !== "LOST" && (
          <button
            type="button"
            className="ml-auto text-sm text-red-600 hover:text-red-700 hover:underline"
            onClick={() => setLostOpen(true)}
          >
            Mark as Lost
          </button>
        )}
        {status === "LOST" && (
          <button
            type="button"
            className="ml-auto text-sm text-foreground hover:underline"
            onClick={() => setConfirmRestore(true)}
          >
            Restore
          </button>
        )}
      </div>

      <MarkAsLostDialog
        leadId={leadId}
        open={lostOpen}
        onOpenChange={setLostOpen}
        onSuccess={() => {
          void onChange?.();
        }}
      />

      <ConfirmationDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title="Restore lead?"
        description="Move this lead back to Contacted so it reappears in the worklist."
        confirmLabel="Restore"
        variant="default"
        onConfirm={undoLost}
      />
    </div>
  );
}
