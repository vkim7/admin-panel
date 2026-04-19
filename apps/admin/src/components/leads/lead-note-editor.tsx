"use client";

import { useState, useTransition } from "react";
import { updateLeadNote } from "@/lib/actions/leads";
import { Pencil } from "lucide-react";

export function LeadNoteEditor({
  leadId,
  currentNote,
}: {
  leadId: string;
  currentNote: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentNote ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const trimmed = value.trim();
    const noteToSave = trimmed === "" ? null : trimmed;

    if (noteToSave === currentNote) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      await updateLeadNote({ id: leadId, adminNote: noteToSave });
      setIsEditing(false);
    });
  }

  if (isEditing) {
    return (
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSave();
          }
          if (e.key === "Escape") {
            setValue(currentNote ?? "");
            setIsEditing(false);
          }
        }}
        disabled={isPending}
        autoFocus
        rows={2}
        className="w-full min-w-[150px] rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
      />
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground max-w-[150px]"
      title={currentNote ?? "Click to add note"}
    >
      {currentNote ? (
        <span className="truncate">{currentNote}</span>
      ) : (
        <span className="italic opacity-60">Add note</span>
      )}
      <Pencil className="size-3 opacity-0 group-hover:opacity-100 shrink-0" />
    </button>
  );
}
