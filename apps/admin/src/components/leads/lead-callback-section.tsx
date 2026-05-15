"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setNextCallback, markCallbackDone } from "@/lib/actions/lead-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

const TASHKENT_OFFSET_MS = 5 * 3600 * 1000;

function tashkentDateAt(hour: number, minute: number, daysAhead: number): Date {
  const nowTashkent = new Date(Date.now() + TASHKENT_OFFSET_MS);
  const y = nowTashkent.getUTCFullYear();
  const m = nowTashkent.getUTCMonth();
  const d = nowTashkent.getUTCDate() + daysAhead;
  return new Date(Date.UTC(y, m, d, hour, minute) - TASHKENT_OFFSET_MS);
}

function plusHours(hours: number): Date {
  return new Date(Date.now() + hours * 3600 * 1000);
}

function formatCallback(date: Date): string {
  return new Date(date).toLocaleString("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayTashkentISODate(): string {
  const nowTashkent = new Date(Date.now() + TASHKENT_OFFSET_MS);
  return nowTashkent.toISOString().slice(0, 10);
}

function customToDate(date: string, slot: string): Date | null {
  if (!date || !slot) return null;
  const [yStr, mStr, dStr] = date.split("-");
  const [hStr, minStr] = slot.split(":");
  if (!yStr || !mStr || !dStr || !hStr || !minStr) return null;
  return new Date(
    Date.UTC(
      Number(yStr),
      Number(mStr) - 1,
      Number(dStr),
      Number(hStr),
      Number(minStr),
    ) - TASHKENT_OFFSET_MS,
  );
}

function ScheduleDialog({
  leadId,
  open,
  onOpenChange,
  onChange,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChange?: () => Promise<void> | void;
}) {
  // Pending selection — committed only when Save is clicked.
  const [pendingAt, setPendingAt] = useState<Date | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState(todayTashkentISODate());
  const [customSlot, setCustomSlot] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setPendingAt(null);
    setPickedKey(null);
    setCustomDate(todayTashkentISODate());
    setCustomSlot("");
  }

  function pickQuick(key: string, at: Date) {
    setPendingAt(at);
    setPickedKey(key);
    setCustomSlot("");
    setCustomDate(todayTashkentISODate());
  }

  function updateCustomDate(date: string) {
    setCustomDate(date);
    const at = customToDate(date, customSlot);
    if (at) {
      setPendingAt(at);
      setPickedKey("custom");
    } else if (pickedKey === "custom") {
      setPendingAt(null);
      setPickedKey(null);
    }
  }

  function updateCustomSlot(slot: string) {
    setCustomSlot(slot);
    const at = customToDate(customDate, slot);
    if (at) {
      setPendingAt(at);
      setPickedKey("custom");
    } else if (pickedKey === "custom") {
      setPendingAt(null);
      setPickedKey(null);
    }
  }

  function save() {
    if (!pendingAt) return;
    startTransition(async () => {
      const result = await setNextCallback({
        id: leadId,
        at: pendingAt.toISOString(),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Callback set for ${formatCallback(pendingAt)}`);
      onOpenChange(false);
      await onChange?.();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule callback</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <div className="flex flex-wrap gap-2">
            {[17, 18, 19].map((hour) => {
              const at = tashkentDateAt(hour, 0, 0);
              const past = at.getTime() < Date.now();
              const key = `h${hour}`;
              return (
                <Button
                  key={key}
                  type="button"
                  variant={pickedKey === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => pickQuick(key, at)}
                  disabled={isPending || past}
                  title={past ? "Already past — use +Xh instead" : undefined}
                >
                  {String(hour).padStart(2, "0")}:00
                </Button>
              );
            })}
            {[1, 2, 3].map((h) => {
              const key = `plus${h}`;
              return (
                <Button
                  key={key}
                  type="button"
                  variant={pickedKey === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => pickQuick(key, plusHours(h))}
                  disabled={isPending}
                >
                  +{h}h
                </Button>
              );
            })}
          </div>

          <div className="my-6 border-t" />

          <div className="flex flex-wrap gap-2 items-center">
            <Input
              type="date"
              value={customDate}
              onChange={(e) => updateCustomDate(e.target.value)}
              className="w-auto"
            />
            <Input
              type="time"
              value={customSlot}
              onChange={(e) => updateCustomSlot(e.target.value)}
              className="w-auto"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={!pendingAt || pendingAt.getTime() <= Date.now() || isPending}
            title={
              pendingAt && pendingAt.getTime() <= Date.now()
                ? "Callback time must be in the future"
                : undefined
            }
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeadCallbackSection({
  leadId,
  nextCallbackAt,
  onChange,
}: {
  leadId: string;
  nextCallbackAt: Date | null;
  onChange?: () => Promise<void> | void;
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);

  async function markDone() {
    const result = await markCallbackDone({ id: leadId });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Callback marked done");
    await onChange?.();
  }

  const isOverdue =
    nextCallbackAt !== null && new Date(nextCallbackAt).getTime() < Date.now();

  return (
    <section className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Callback</h3>
        {!nextCallbackAt && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScheduleOpen(true)}
          >
            Schedule
          </Button>
        )}
      </div>

      {nextCallbackAt && (
        <div className="flex items-center justify-between text-sm">
          <span>
            <span className="text-muted-foreground">
              {isOverdue ? "Overdue: " : "Scheduled: "}
            </span>
            <span className={isOverdue ? "text-red-600 font-medium" : ""}>
              {formatCallback(nextCallbackAt)}
            </span>
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setConfirmDone(true)}
            >
              Mark done
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScheduleOpen(true)}
            >
              Reschedule
            </Button>
          </div>
        </div>
      )}

      <ScheduleDialog
        leadId={leadId}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onChange={onChange}
      />

      <ConfirmationDialog
        open={confirmDone}
        onOpenChange={setConfirmDone}
        title="Mark callback done?"
        description={`This clears the scheduled callback (${nextCallbackAt ? formatCallback(nextCallbackAt) : ""}) and logs it as completed.`}
        confirmLabel="Mark done"
        variant="default"
        onConfirm={markDone}
      />
    </section>
  );
}
