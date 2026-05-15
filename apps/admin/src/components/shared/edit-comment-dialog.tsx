"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";

interface EditCommentDialogProps {
  currentComment: string | null;
  onSave: (comment: string | null) => Promise<{ error?: string }>;
  title?: string;
  /**
   * Display mode for the trigger when a comment exists:
   * - "truncate" (default): single-line truncation, 200px max, preserves
   *   existing behavior in every callsite.
   * - "multiline": preserves newlines (`whitespace-pre-wrap`), clamps to 3
   *   visible lines, wider max width. Matches the /leads Note column.
   */
  displayMode?: "truncate" | "multiline";
}

export function EditCommentDialog({
  currentComment,
  onSave,
  title = "Edit Comment",
  displayMode = "truncate",
}: EditCommentDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentComment ?? "");
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) setValue(currentComment ?? "");
  }

  function handleSave() {
    const trimmed = value.trim();
    startTransition(async () => {
      const result = await onSave(trimmed || null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Comment updated");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {currentComment ? (
          <button
            type="button"
            className={
              displayMode === "multiline"
                ? "block max-w-md cursor-pointer whitespace-pre-wrap text-left text-sm line-clamp-3 hover:underline"
                : "max-w-[200px] cursor-pointer truncate text-left text-sm hover:underline"
            }
            title={currentComment}
          >
            {currentComment}
          </button>
        ) : (
          <button
            type="button"
            className="text-muted-foreground/50 hover:text-muted-foreground cursor-pointer"
            aria-label="Add comment"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Enter or update the comment text below.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Enter a comment..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
