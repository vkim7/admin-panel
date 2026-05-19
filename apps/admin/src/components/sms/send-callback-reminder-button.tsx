"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { sendCallbackReminder } from "@/lib/actions/sms";

/**
 * Trigger button for the manual callback-reminder SMS. Surface this only
 * inside the Communications section of the LeadDrawer when the lead's
 * status is NEW or CONTACTED — the server action enforces the same gate,
 * but hiding the button keeps the UI honest.
 *
 * Clicking opens a ConfirmationDialog instead of firing immediately —
 * sends cost money and a misclick on the wrong lead is awkward. The
 * dialog uses its own useTransition for the pending state.
 *
 * onSent is called after a successful send so the drawer can refetch
 * detail (re-render the timeline with the new SmsHistory row).
 */
export function SendCallbackReminderButton({
  leadId,
  onSent,
}: {
  leadId: string;
  onSent: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await sendCallbackReminder(leadId);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reminder sent");
    await onSent();
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        Send callback reminder
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Send callback reminder?"
        description="A callback-reminder SMS will be sent to this lead's phone right away. This action cannot be undone."
        confirmLabel="Send"
        variant="default"
        onConfirm={handleConfirm}
      />
    </>
  );
}
