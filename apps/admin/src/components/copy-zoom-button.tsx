"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyZoomButton({ zoomLink }: { zoomLink: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!zoomLink) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(zoomLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="text-muted-foreground h-3.5 w-3.5" />
      )}
    </Button>
  );
}
