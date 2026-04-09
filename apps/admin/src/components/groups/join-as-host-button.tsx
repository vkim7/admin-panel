"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getZoomHostUrl } from "@/lib/actions/groups";

export function JoinAsHostButton({ groupId }: { groupId: string }) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const result = await getZoomHostUrl(groupId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
        toast.success("Teacher link copied");
        setTimeout(() => setCopied(false), 1500);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm text-muted-foreground">Teacher Link</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    </span>
  );
}
