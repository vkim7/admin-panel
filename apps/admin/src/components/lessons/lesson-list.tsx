"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { CompleteLessonButton } from "./complete-lesson-button";
import { CancelLessonDialog } from "./cancel-lesson-dialog";
import { StudentCancelDialog } from "./student-cancel-dialog";
import { RescheduleDialog } from "./reschedule-dialog";
import type { LessonWithDetails } from "@/lib/queries/lessons";
import type { CancellationReasonOption } from "@/lib/queries/lessons";

const DAY_SHORT: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

interface LessonListProps {
  lessons: LessonWithDetails[];
  groupId: string;
  groupType: string;
  cancellationReasons: CancellationReasonOption[];
  studentCancellationsThisMonth: number;
}

export function LessonList({
  lessons,
  groupId,
  groupType,
  cancellationReasons,
  studentCancellationsThisMonth,
}: LessonListProps) {
  const [showPast, setShowPast] = useState(false);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const upcoming = lessons.filter(
    (l) =>
      l.lessonDate >= today &&
      (l.status === "SCHEDULED" || l.status === "PENDING_RESOLUTION"),
  );

  const past = lessons.filter(
    (l) =>
      l.status === "COMPLETED" ||
      l.status === "CANCELLED" ||
      (l.lessonDate < today && l.status === "SCHEDULED"),
  );

  // Also include past PENDING_RESOLUTION
  const pastPending = lessons.filter(
    (l) => l.lessonDate < today && l.status === "PENDING_RESOLUTION",
  );
  const allPast = [...past, ...pastPending].sort(
    (a, b) => b.lessonDate.getTime() - a.lessonDate.getTime(),
  );

  const completed = lessons.filter((l) => l.status === "COMPLETED").length;
  const cancelled = lessons.filter((l) => l.status === "CANCELLED").length;
  const pending = lessons.filter((l) => l.status === "PENDING_RESOLUTION").length;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">
        Lessons{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({lessons.length} total, {completed} completed
          {cancelled > 0 ? `, ${cancelled} cancelled` : ""}
          {pending > 0 ? `, ${pending} pending` : ""})
        </span>
      </h3>

      {/* Upcoming lessons */}
      {upcoming.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Teacher</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    groupType={groupType}
                    cancellationReasons={cancellationReasons}
                    studentCancellationsThisMonth={studentCancellationsThisMonth}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past lessons — collapsible */}
      {allPast.length > 0 && (
        <details open={showPast} onToggle={(e) => setShowPast((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Past ({allPast.length})
          </summary>
          <div className="mt-1 rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Teacher</th>
                  <th className="px-3 py-2 text-left font-medium">Students</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPast.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    groupType={groupType}
                    cancellationReasons={cancellationReasons}
                    showStudentCount
                    studentCancellationsThisMonth={studentCancellationsThisMonth}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {lessons.length === 0 && (
        <p className="text-sm text-muted-foreground">No lessons.</p>
      )}
    </div>
  );
}

function LessonRow({
  lesson,
  groupType,
  cancellationReasons,
  showStudentCount,
  studentCancellationsThisMonth,
}: {
  lesson: LessonWithDetails;
  groupType: string;
  cancellationReasons: CancellationReasonOption[];
  showStudentCount?: boolean;
  studentCancellationsThisMonth: number;
}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const isSubstitute = lesson.teacherId !== lesson.originalTeacherId;
  const isRescheduled = lesson.originalDate !== null;
  const canComplete = lesson.status === "SCHEDULED" && lesson.lessonDate <= today;
  const canCancel = lesson.status === "SCHEDULED" || lesson.status === "PENDING_RESOLUTION";
  const canStudentCancel =
    groupType === "INDIVIDUAL" &&
    lesson.status === "SCHEDULED" &&
    lesson.lessonDate >= today;
  const canReschedule =
    groupType === "INDIVIDUAL" && lesson.status === "SCHEDULED";

  const dayOfWeek = DAY_SHORT[lesson.lessonDate.getUTCDay()] ?? "";
  const dateStr = lesson.lessonDate.toLocaleDateString("en-GB", { timeZone: "UTC" });

  return (
    <tr className="border-t">
      <td className="px-3 py-2 tabular-nums">{lesson.lessonNumber}</td>
      <td className="px-3 py-2">
        <span className="tabular-nums">{dateStr}</span>{" "}
        <span className="text-muted-foreground">{dayOfWeek}</span>
        {isRescheduled && lesson.originalDate && (
          <span className="ml-1 text-xs text-muted-foreground">
            (was {lesson.originalDate.toLocaleDateString("en-GB", { timeZone: "UTC" })})
          </span>
        )}
      </td>
      <td className="px-3 py-2 tabular-nums">{lesson.startTime}</td>
      <td className="px-3 py-2">
        <StatusBadge type="lesson" value={lesson.status} />
        {lesson.status === "CANCELLED" && lesson.cancellationReason && (
          <span className="ml-1 text-xs text-muted-foreground">
            {lesson.cancellationReason.name}
          </span>
        )}
        {lesson.rescheduledFrom && (
          <span className="ml-1 text-xs text-muted-foreground">
            (replaces #{lesson.rescheduledFrom.lessonNumber})
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {lesson.teacher.firstName} {lesson.teacher.lastName}
        {isSubstitute && (
          <span className="ml-1 text-xs font-medium text-amber-600">sub</span>
        )}
      </td>
      {showStudentCount && (
        <td className="px-3 py-2 tabular-nums text-muted-foreground">
          {lesson.activeStudentCount ?? "—"}
        </td>
      )}
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {canComplete && <CompleteLessonButton lessonId={lesson.id} />}
          {canCancel && (
            <CancelLessonDialog
              lessonId={lesson.id}
              cancellationReasons={cancellationReasons}
            />
          )}
          {canStudentCancel && (
            <StudentCancelDialog
              lessonId={lesson.id}
              cancellationsUsed={studentCancellationsThisMonth}
            />
          )}
          {canReschedule && <RescheduleDialog lessonId={lesson.id} />}
        </div>
      </td>
    </tr>
  );
}
