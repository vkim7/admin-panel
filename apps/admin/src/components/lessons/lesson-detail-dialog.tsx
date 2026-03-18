"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { CompleteLessonDialog } from "./complete-lesson-button";
import { CancelLessonDialog } from "./cancel-lesson-dialog";
import { StudentCancelDialog } from "./student-cancel-dialog";
import { RescheduleDialog } from "./reschedule-dialog";
import { initializeAttendance } from "@/lib/actions/attendance";
import type { LessonWithDetails, CancellationReasonOption } from "@/lib/queries/lessons";

const DAY_NAME: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
  4: "Thursday", 5: "Friday", 6: "Saturday",
};

interface LessonDetailDialogProps {
  lesson: LessonWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupType: string;
  cancellationReasons: CancellationReasonOption[];
  studentCancellationsThisMonth: number;
  hasAttendance: boolean;
}

export function LessonDetailDialog({
  lesson,
  open,
  onOpenChange,
  groupType,
  cancellationReasons,
  studentCancellationsThisMonth,
  hasAttendance,
}: LessonDetailDialogProps) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [studentCancelOpen, setStudentCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [isInitPending, startInitTransition] = useTransition();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const isSubstitute = lesson.teacherId !== lesson.originalTeacherId;
  const isRescheduled = lesson.originalDate !== null;
  const lessonDate = new Date(lesson.lessonDate);
  const canTakeAttendance =
    !hasAttendance &&
    (lesson.status === "SCHEDULED" || lesson.status === "COMPLETED") &&
    lessonDate <= today;
  const canComplete =
    hasAttendance &&
    lesson.status === "SCHEDULED" &&
    lessonDate <= today;
  const canCancel = lesson.status === "SCHEDULED" || lesson.status === "PENDING_RESOLUTION";
  const canStudentCancel =
    groupType === "INDIVIDUAL" &&
    lesson.status === "SCHEDULED" &&
    lessonDate >= today;
  const canReschedule =
    groupType === "INDIVIDUAL" && lesson.status === "SCHEDULED";

  const dateStr = lesson.lessonDate.toLocaleDateString("en-GB", { timeZone: "UTC" });
  const dayName = DAY_NAME[lesson.lessonDate.getUTCDay()] ?? "";

  const hasActions = canComplete || canTakeAttendance || canCancel || canStudentCancel || canReschedule;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lesson #{lesson.lessonNumber}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {/* Date & time */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>
                {dateStr} ({dayName})
                {isRescheduled && lesson.originalDate && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    was {lesson.originalDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Time</span>
              <span>{lesson.startTime}</span>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge type="lesson" value={lesson.status} />
            </div>

            {/* Teacher */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Teacher</span>
              <span>
                {lesson.teacher.firstName} {lesson.teacher.lastName}
                {isSubstitute && (
                  <span className="ml-1 text-xs font-medium text-amber-600">sub</span>
                )}
              </span>
            </div>

            {/* Students count (completed) */}
            {lesson.activeStudentCount != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Students</span>
                <span>{lesson.activeStudentCount}</span>
              </div>
            )}

            {/* Attendance status */}
            {lesson.status === "COMPLETED" && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Attendance</span>
                <span>{hasAttendance ? "Taken" : "Not taken"}</span>
              </div>
            )}

            {/* Cancellation reason */}
            {lesson.status === "CANCELLED" && lesson.cancellationReason && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reason</span>
                <span>{lesson.cancellationReason.name}</span>
              </div>
            )}

            {/* Rescheduled from */}
            {lesson.rescheduledFrom && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Replaces</span>
                <span>Lesson #{lesson.rescheduledFrom.lessonNumber}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          {hasActions && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {canTakeAttendance && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isInitPending}
                    onClick={() => {
                      startInitTransition(async () => {
                        const result = await initializeAttendance({ lessonId: lesson.id });
                        if (result?.error) {
                          toast.error(result.error);
                        } else {
                          toast.success("Attendance initialized");
                          onOpenChange(false);
                        }
                      });
                    }}
                  >
                    {isInitPending ? "..." : "Take Attendance"}
                  </Button>
                )}
                {canComplete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompleteOpen(true)}
                  >
                    Complete
                  </Button>
                )}
                {canCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel
                  </Button>
                )}
                {canStudentCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={studentCancellationsThisMonth >= 2}
                    onClick={() => setStudentCancelOpen(true)}
                  >
                    Student Cancel
                  </Button>
                )}
                {canReschedule && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRescheduleOpen(true)}
                  >
                    Reschedule
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      <CompleteLessonDialog
        lessonId={lesson.id}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
      />
      <CancelLessonDialog
        lessonId={lesson.id}
        cancellationReasons={cancellationReasons}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
      <StudentCancelDialog
        lessonId={lesson.id}
        cancellationsUsed={studentCancellationsThisMonth}
        open={studentCancelOpen}
        onOpenChange={setStudentCancelOpen}
      />
      <RescheduleDialog
        lessonId={lesson.id}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
      />
    </>
  );
}
