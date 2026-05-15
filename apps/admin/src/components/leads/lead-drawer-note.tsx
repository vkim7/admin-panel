"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { updateLeadNote } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LeadDrawerNote({
  leadId,
  initialNote,
  onChange,
}: {
  leadId: string;
  initialNote: string | null;
  onChange?: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initialNote ?? "");
  const [isPending, startTransition] = useTransition();

  // When detail refetches (e.g. another tab updated), sync local draft only
  // while the dialog is closed — don't clobber what admin is currently typing.
  useEffect(() => {
    if (!open) setDraft(initialNote ?? "");
  }, [leadId, initialNote, open]);

  function save() {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : trimmed;

    startTransition(async () => {
      const result = await updateLeadNote({ id: leadId, adminNote: next });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Note saved");
      setOpen(false);
      await onChange?.();
    });
  }

  return (
    <section className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Note</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Change
        </Button>
      </div>

      {initialNote && (
        <p className="text-sm whitespace-pre-wrap">{initialNote}</p>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setDraft(initialNote ?? "");
          setOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit note</DialogTitle>
          </DialogHeader>

          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            maxLength={1000}
            autoFocus
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
