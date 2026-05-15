"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { markTestSent, recordTestScore } from "@/lib/actions/lead-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LEVEL_LABEL } from "@/lib/constants";
import type { Level } from "@eng/database";

const LEVELS_FOR_TEST: Level[] = [
  "BEGINNER",
  "ELEMENTARY",
  "PRE_INTERMEDIATE",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
];

function formatTimestamp(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleString("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadTestSection({
  leadId,
  testSentAt,
  testLevelSent,
  testScore,
  testScoredAt,
  onChange,
}: {
  leadId: string;
  testSentAt: Date | null;
  testLevelSent: Level | null;
  testScore: number | null;
  testScoredAt: Date | null;
  onChange?: () => Promise<void> | void;
}) {
  const [sentOpen, setSentOpen] = useState(false);
  const [pickedLevel, setPickedLevel] = useState<Level | null>(testLevelSent);

  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreInput, setScoreInput] = useState("");

  const [isPending, startTransition] = useTransition();

  function submitSent() {
    if (!pickedLevel) return;
    startTransition(async () => {
      const result = await markTestSent({ id: leadId, level: pickedLevel });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Test marked sent: ${LEVEL_LABEL[pickedLevel]}`);
      setSentOpen(false);
      await onChange?.();
    });
  }

  function submitScore() {
    const n = Number(scoreInput);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      toast.error("Score must be a whole number between 0 and 100");
      return;
    }
    startTransition(async () => {
      const result = await recordTestScore({ id: leadId, score: n });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Score recorded: ${n}/100`);
      setScoreOpen(false);
      setScoreInput("");
      await onChange?.();
    });
  }

  const stalenessHours = testSentAt
    ? (Date.now() - new Date(testSentAt).getTime()) / 3600_000
    : 0;
  const isStale = testSentAt && testScore === null && stalenessHours > 24;

  // Header action: primary action that always exists for the section
  const headerAction = !testSentAt ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        setPickedLevel(testLevelSent);
        setSentOpen(true);
      }}
      disabled={isPending}
    >
      Mark sent
    </Button>
  ) : null;

  return (
    <section className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Placement test</h3>
        {headerAction}
      </div>

      {testSentAt && testLevelSent && (
        <div className="text-sm">
          <span className="text-muted-foreground">Test sent: </span>
          {LEVEL_LABEL[testLevelSent]} · {formatTimestamp(testSentAt)}
          {isStale && (
            <span className="ml-2 text-red-600">
              (no score after {Math.floor(stalenessHours)}h)
            </span>
          )}
        </div>
      )}

      {testSentAt && (
        <div className="flex items-center justify-between text-sm">
          <span>
            <span className="text-muted-foreground">Test score: </span>
            {testScore !== null ? (
              <>
                {testScore}/100 · {formatTimestamp(testScoredAt)}
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setScoreInput(testScore !== null ? String(testScore) : "");
              setScoreOpen(true);
            }}
            disabled={isPending}
          >
            Change
          </Button>
        </div>
      )}

      <Dialog open={sentOpen} onOpenChange={setSentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {testSentAt ? "Re-send placement test" : "Mark test sent"}
            </DialogTitle>
            <DialogDescription>
              Which level did you send?
              {testSentAt && " (This clears any prior score.)"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {LEVELS_FOR_TEST.map((lvl) => (
              <label
                key={lvl}
                className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent"
              >
                <input
                  type="radio"
                  name="test-level"
                  value={lvl}
                  checked={pickedLevel === lvl}
                  onChange={() => setPickedLevel(lvl)}
                  className="size-4"
                />
                <span className="text-sm">{LEVEL_LABEL[lvl]}</span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSentOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitSent}
              disabled={!pickedLevel || isPending}
            >
              {isPending ? "Saving..." : "Confirm sent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record test score</DialogTitle>
            <DialogDescription>
              {testLevelSent && `Test sent: ${LEVEL_LABEL[testLevelSent]}. `}
              Enter the score (0–100).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="score-input">Score</Label>
            <Input
              id="score-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setScoreOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitScore}
              disabled={!scoreInput || isPending}
            >
              {isPending ? "Saving..." : "Save score"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
