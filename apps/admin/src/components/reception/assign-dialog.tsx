"use client";

import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { addStudentsToGroup } from "@/lib/actions/group-memberships";
import { DAYS_LABEL, LEVEL_SHORT, STAGE_SHORT, LEVEL_STAGE_ORDER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export type GroupOption = {
  id: string;
  publicId: string;
  type: string;
  level: string;
  progressStage: string;
  days: number[];
  startTime: string;
  teacherName: string;
  availableSeats: number;
  maxStudents: number;
  teachingLanguage: string;
};

export type StudentForAssign = {
  id: string;
  firstName: string;
  lastName: string;
  level: string;
  progressStage: string;
  preferredDays: number[];
  preferredTimeSlots: string[];
  preferredLanguage: string;
};

// Language hard-enforcement applies at these levels
const LANGUAGE_HARD_LEVELS = new Set(["BEGINNER", "ELEMENTARY"]);

const assignFormSchema = z.object({
  groupId: z.string().min(1, "Select a group"),
  joinDate: z.string().min(1, "Join date is required"),
});

type AssignFormValues = z.infer<typeof assignFormSchema>;

interface AssignDialogProps {
  student: StudentForAssign;
  groups: GroupOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignDialog({
  student,
  groups,
  open,
  onOpenChange,
}: AssignDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<AssignFormValues>({
    resolver: zodResolver(assignFormSchema),
    defaultValues: {
      groupId: "",
      joinDate: new Date().toISOString().split("T")[0]!,
    },
  });

  const selectedGroupId = form.watch("groupId");

  function groupMatchesLanguage(group: GroupOption) {
    const lang = student.preferredLanguage;
    if (lang === "ANY") return true;
    // Teacher with ANY (both) can teach any language
    if (group.teachingLanguage === "ANY") return true;
    // Specific match: student wants UZBEK, teacher teaches UZBEK
    return lang === group.teachingLanguage;
  }

  function matchesDays(group: GroupOption) {
    return (
      student.preferredDays.length > 0 &&
      group.days.join(",") === student.preferredDays.join(",")
    );
  }

  function matchesTime(group: GroupOption) {
    return (
      student.preferredTimeSlots.length > 0 &&
      student.preferredTimeSlots.includes(group.startTime)
    );
  }

  const { bestMatch, abovePlacement, belowPlacement } = useMemo(() => {
    const studentKey = `${student.level}:${student.progressStage}`;
    const studentIdx = LEVEL_STAGE_ORDER.indexOf(studentKey);

    // Hard language filter: BEGINNER/ELEMENTARY with specific language preference
    const isHardLanguage =
      LANGUAGE_HARD_LEVELS.has(student.level) &&
      student.preferredLanguage !== "ANY";

    const eligible = groups.filter((g) => {
      const groupKey = `${g.level}:${g.progressStage}`;
      const groupIdx = LEVEL_STAGE_ORDER.indexOf(groupKey);
      if (studentIdx === -1 || groupIdx === -1) return false;

      // Within 3 stages
      const distance = Math.abs(groupIdx - studentIdx);
      if (distance > 3) return false;

      // Hard language enforcement: exclude mismatched groups entirely
      if (isHardLanguage && !groupMatchesLanguage(g)) return false;

      return true;
    });

    const best: GroupOption[] = [];
    const above: GroupOption[] = [];
    const below: GroupOption[] = [];

    for (const g of eligible) {
      const groupKey = `${g.level}:${g.progressStage}`;
      const groupIdx = LEVEL_STAGE_ORDER.indexOf(groupKey);
      const distance = groupIdx - studentIdx;

      if (
        distance === 0 &&
        matchesDays(g) &&
        matchesTime(g) &&
        groupMatchesLanguage(g)
      ) {
        best.push(g);
      } else if (distance > 0) {
        above.push(g);
      } else {
        // distance < 0 or distance === 0 but not best match
        if (distance === 0) {
          // Exact level+stage but doesn't match all preferences — show in "above" as closest
          above.push(g);
        } else {
          below.push(g);
        }
      }
    }

    // Sort best: language match boost, then seats
    best.sort((a, b) => b.availableSeats - a.availableSeats);

    // Sort above: distance ASC (closest first), then seats DESC
    above.sort((a, b) => {
      const aIdx = LEVEL_STAGE_ORDER.indexOf(`${a.level}:${a.progressStage}`);
      const bIdx = LEVEL_STAGE_ORDER.indexOf(`${b.level}:${b.progressStage}`);
      const distDiff = (aIdx - studentIdx) - (bIdx - studentIdx);
      if (distDiff !== 0) return distDiff;
      return b.availableSeats - a.availableSeats;
    });

    // Sort below: closest to student first (distance ASC = least negative first), then seats DESC
    below.sort((a, b) => {
      const aIdx = LEVEL_STAGE_ORDER.indexOf(`${a.level}:${a.progressStage}`);
      const bIdx = LEVEL_STAGE_ORDER.indexOf(`${b.level}:${b.progressStage}`);
      const distDiff = (bIdx - studentIdx) - (aIdx - studentIdx);
      if (distDiff !== 0) return distDiff;
      return b.availableSeats - a.availableSeats;
    });

    return { bestMatch: best, abovePlacement: above, belowPlacement: below };
  }, [groups, student]);

  function getDaysLabel(days: number[]) {
    const key = days.join(",");
    return DAYS_LABEL[key] ?? days.join(",");
  }

  function onSubmit(values: AssignFormValues) {
    startTransition(async () => {
      const result = await addStudentsToGroup(values.groupId, {
        studentIds: [student.id],
        joinDate: values.joinDate,
        isTrial: true,
        comment: null,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          `${student.firstName} ${student.lastName} assigned to group`,
        );
        onOpenChange(false);
        form.reset();
      }
    });
  }

  function getGroupLanguage(group: GroupOption): string | null {
    if (group.teachingLanguage === "UZBEK") return "UZ";
    if (group.teachingLanguage === "RUSSIAN") return "RU";
    return null; // ANY = both = assumed default, not shown
  }

  function renderGroupRow(group: GroupOption) {
    const isSelected = selectedGroupId === group.id;

    const levelLabel = LEVEL_SHORT[group.level] ?? group.level;
    const stageLabel = STAGE_SHORT[group.progressStage] ?? group.progressStage;
    const activeCount = group.maxStudents - group.availableSeats;

    return (
      <button
        key={group.id}
        type="button"
        onClick={() => form.setValue("groupId", group.id)}
        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
          isSelected
            ? "border-primary bg-primary/5"
            : "hover:bg-accent"
        }`}
      >
        {isSelected && <Check className="size-4 shrink-0 text-primary" />}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="font-medium">{group.publicId}</span>
              {getGroupLanguage(group) && (
                <span className="text-muted-foreground">{getGroupLanguage(group)}</span>
              )}
            </span>
            <span className="text-xs font-medium text-foreground/70">
              {levelLabel} · {stageLabel}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{group.teacherName} · {activeCount}/{group.maxStudents}</span>
            <span>{getDaysLabel(group.days)} {group.startTime}</span>
          </div>
        </div>
      </button>
    );
  }

  const hasNoGroups =
    bestMatch.length === 0 &&
    abovePlacement.length === 0 &&
    belowPlacement.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) form.reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Assign {student.firstName} {student.lastName}
          </DialogTitle>
        </DialogHeader>

        {/* Student info */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <Badge variant="secondary">
            {LEVEL_SHORT[student.level] ?? student.level}
            {" · "}
            {STAGE_SHORT[student.progressStage] ?? student.progressStage}
          </Badge>
          {student.preferredDays.length > 0 && (
            <span className="text-muted-foreground">
              Prefers: {getDaysLabel(student.preferredDays)}
            </span>
          )}
          {student.preferredTimeSlots.length > 0 && (
            <span className="text-muted-foreground">
              {student.preferredTimeSlots.join(", ")}
            </span>
          )}
          {LANGUAGE_HARD_LEVELS.has(student.level) && (
            <span className="text-muted-foreground">
              Lang:{" "}
              {student.preferredLanguage === "UZBEK"
                ? "Uzbek"
                : student.preferredLanguage === "RUSSIAN"
                  ? "Russian"
                  : "Any"}
            </span>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Group selection */}
            <FormField
              control={form.control}
              name="groupId"
              render={() => (
                <FormItem>
                  <FormLabel>Select Group</FormLabel>
                  <div className="max-h-60 space-y-3 overflow-y-auto">
                    {bestMatch.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          Best match
                        </p>
                        {bestMatch.map(renderGroupRow)}
                      </div>
                    )}
                    {abovePlacement.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          Above
                        </p>
                        {abovePlacement.map(renderGroupRow)}
                      </div>
                    )}
                    {belowPlacement.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          Below
                        </p>
                        {belowPlacement.map(renderGroupRow)}
                      </div>
                    )}
                    {hasNoGroups && (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No groups with available seats at this level
                      </p>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Join Date */}
            <FormField
              control={form.control}
              name="joinDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Join Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !selectedGroupId}
              >
                {isPending ? "Assigning..." : "Assign to Group"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
