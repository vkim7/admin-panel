"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createGroupZoomMeeting } from "@/lib/actions/groups";

export function CreateZoomMeetingButton({ groupId }: { groupId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await createGroupZoomMeeting(groupId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Zoom meeting created");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      <Video className="mr-1 size-4" />
      {isPending ? "Creating..." : "Create Zoom Meeting"}
    </Button>
  );
}
