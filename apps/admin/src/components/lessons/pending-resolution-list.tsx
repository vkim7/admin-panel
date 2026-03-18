"use client";

import Link from "next/link";
import { SubstitutePicker } from "./substitute-picker";
import { CancelLessonDialog } from "./cancel-lesson-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PendingLesson, CancellationReasonOption } from "@/lib/queries/lessons";

interface PendingResolutionListProps {
  lessons: PendingLesson[];
  cancellationReasons: CancellationReasonOption[];
  substitutesMap: Record<string, { id: string; firstName: string; lastName: string }[]>;
}

export function PendingResolutionList({
  lessons,
  cancellationReasons,
  substitutesMap,
}: PendingResolutionListProps) {
  if (lessons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No pending resolution lessons.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">Group</th>
            <th className="px-3 py-2 text-left font-medium">Lesson #</th>
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-left font-medium">Time</th>
            <th className="px-3 py-2 text-left font-medium">Original Teacher</th>
            <th className="px-3 py-2 text-left font-medium">Pending Since</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson) => {
            const subs = substitutesMap[lesson.id] ?? [];
            return (
              <tr key={lesson.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  <Link
                    href={`/groups/${lesson.groupId}`}
                    className="text-primary hover:underline"
                  >
                    {lesson.group.publicId}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">{lesson.lessonNumber}</td>
                <td className="px-3 py-2 tabular-nums">
                  {lesson.lessonDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}
                </td>
                <td className="px-3 py-2 tabular-nums">{lesson.startTime}</td>
                <td className="px-3 py-2">
                  {lesson.originalTeacher.firstName} {lesson.originalTeacher.lastName}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {lesson.pendingAt
                    ? new Date(lesson.pendingAt).toLocaleDateString("en-GB")
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <SubstitutePicker
                      lessonId={lesson.id}
                      availableSubstitutes={subs}
                    />
                    <CancelLessonDialog
                      lessonId={lesson.id}
                      cancellationReasons={cancellationReasons}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
