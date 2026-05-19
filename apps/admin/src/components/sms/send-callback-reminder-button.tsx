"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendCallbackReminder } from "@/lib/actions/sms";

/**
 * Trigger button for the manual callback-reminder SMS. Surface this only
 * inside the Communications section of the LeadDrawer when the lead's
 * status is NEW or CONTACTED — the server action enforces the same gate,
 * but hiding the button keeps the UI honest.
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
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await sendCallbackReminder(leadId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Reminder sent");
      await onSent();
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "Sending…" : "Send callback reminder"}
    </Button>
  );
}
