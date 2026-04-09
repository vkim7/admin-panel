"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleAttendance } from "@/lib/actions/attendance";
import { LessonDetailDialog } from "./lesson-detail-dialog";
import type {
  LessonWithDetails,
  CancellationReasonOption,
} from "@/lib/queries/lessons";
import type { AttendanceRecord } from "@/lib/queries/attendance";
import { Video } from "lucide-react";

// ─── Attendance Cell ────────────────────────────────────────────────────────

function AttendanceCell({
  attendanceId,
  isAbsent,
}: {
  attendanceId: string;
  isAbsent: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await toggleAttendance({
            attendanceId,
            isAbsent: !isAbsent,
          });
          if (result?.error) {
            toast.error(result.error);
          }
        });
      }}
      className={`flex size-8 items-center justify-center rounded text-xs font-medium transition-colors ${
        isPending
          ? "cursor-wait opacity-50"
          : isAbsent
            ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "text-green-700 hover:bg-muted"
      }`}
      title={
        isAbsent
          ? "Absent — click to mark present"
          : "Present — click to mark absent"
      }
    >
      {isPending ? "..." : isAbsent ? "A" : "\u2713"}
    </button>
  );
}

// ─── Column header styling by status ────────────────────────────────────────

function getColumnHeaderClasses(
  lesson: LessonWithDetails,
  isNextLesson: boolean,
  needsAttention: boolean,
): string {
  const base =
    "cursor-pointer px-6 py-2 text-center font-medium transition-colors hover:bg-muted/80";

  if (isNextLesson) {
    return `${base} bg-blue-50 text-blue-800`;
  }
  if (lesson.status === "CANCELLED") {
    return `${base} bg-muted/40 text-muted-foreground`;
  }
  if (lesson.status === "PENDING_RESOLUTION") {
    return `${base} bg-amber-50 text-amber-800`;
  }
  // Past/today SCHEDULED lesson — admin hasn't completed it yet
  if (needsAttention) {
    return `${base} bg-orange-50 text-orange-700`;
  }
  return base;
}

// ─── Lesson Grid ────────────────────────────────────────────────────────────

export interface ActiveMember {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
}

interface LessonGridProps {
  lessons: LessonWithDetails[];
  groupId: string;
  groupType: string;
  cancellationReasons: CancellationReasonOption[];
  studentCancellationsThisMonth: number;
  attendanceRecords: AttendanceRecord[];
  lessonAttendanceStatus: string[];
  activeMembers: ActiveMember[];
  recordingCounts: Record<string, number>;
}

export function LessonGrid({
  lessons,
  groupId,
  groupType,
  cancellationReasons,
  studentCancellationsThisMonth,
  attendanceRecords,
  lessonAttendanceStatus,
  activeMembers,
  recordingCounts,
}: LessonGridProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const selectedLesson = selectedLessonId
    ? (lessons.find((l) => l.id === selectedLessonId) ?? null)
    : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextLessonRef = useRef<HTMLTableCellElement>(null);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Build Set from serialized array
  const attendanceStatusSet = new Set(lessonAttendanceStatus);

  // Build attendance lookup: studentId-lessonId → record
  const attendanceLookup = new Map<string, { id: string; isAbsent: boolean }>();
  for (const r of attendanceRecords) {
    attendanceLookup.set(`${r.studentId}-${r.lessonId}`, {
      id: r.id,
      isAbsent: r.isAbsent,
    });
  }

  // Absent counts per lesson
  const absentCounts = new Map<string, number>();
  for (const r of attendanceRecords) {
    if (r.isAbsent) {
      absentCounts.set(r.lessonId, (absentCounts.get(r.lessonId) ?? 0) + 1);
    }
  }

  // Sort lessons by date
  const sortedLessons = [...lessons].sort(
    (a, b) => a.lessonDate.getTime() - b.lessonDate.getTime(),
  );

  // Lesson summary
  const completed = lessons.filter((l) => l.status === "COMPLETED").length;
  const cancelled = lessons.filter((l) => l.status === "CANCELLED").length;
  const pending = lessons.filter(
    (l) => l.status === "PENDING_RESOLUTION",
  ).length;

  const students = [...activeMembers].sort((a, b) =>
    a.crmCode.localeCompare(b.crmCode, undefined, { numeric: true }),
  );

  // Find the next upcoming lesson (first with date >= today)
  const nextLessonIndex = sortedLessons.findIndex(
    (l) => new Date(l.lessonDate) >= today,
  );

  // Auto-scroll to the next lesson column on mount
  useEffect(() => {
    if (nextLessonRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const cell = nextLessonRef.current;
      // Center the column in the scroll container
      const offset = cell.offsetLeft - container.clientWidth / 2 + cell.offsetWidth / 2;
      container.scrollLeft = Math.max(0, offset);
    }
  }, []);

  if (lessons.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Lessons</h3>
        <p className="text-muted-foreground text-sm">No lessons.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">
        Lessons{" "}
        <span className="text-muted-foreground text-sm font-normal">
          ({lessons.length} total, {completed} completed
          {cancelled > 0 ? `, ${cancelled} cancelled` : ""}
          {pending > 0 ? `, ${pending} pending` : ""})
        </span>
      </h3>

      <div ref={scrollRef} className="overflow-x-auto rounded-md border">
        <table className="text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th
                className="bg-muted/50 sticky left-0 z-10 px-3 py-2"
                style={{ backgroundColor: "#fafafa" }}
              />
              {sortedLessons.map((l, i) => {
                const isCancelled = l.status === "CANCELLED";
                const needsAttention =
                  l.status === "SCHEDULED" &&
                  new Date(l.lessonDate) <= today;
                return (
                  <th
                    key={l.id}
                    ref={i === nextLessonIndex ? nextLessonRef : undefined}
                    className={getColumnHeaderClasses(l, i === nextLessonIndex, needsAttention)}
                    title={`Lesson #${l.lessonNumber} — ${l.lessonDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}${needsAttention ? " — not completed" : ""} — click for details`}
                    onClick={() => setSelectedLessonId(l.id)}
                  >
                    <div
                      className={`whitespace-nowrap ${isCancelled ? "line-through" : ""}`}
                    >
                      {l.lessonDate.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      })}
                    </div>
                    {(recordingCounts[l.id] ?? 0) > 0 && (
                      <Video className="mx-auto mt-0.5 size-3 text-blue-500" />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t">
                <td
                  className="sticky left-0 z-10 px-3 py-2 whitespace-nowrap"
                  style={{ backgroundColor: "#fff" }}
                >
                  {student.firstName} {student.lastName}
                </td>
                {sortedLessons.map((lesson) => {
                  const hasAttendance = attendanceStatusSet.has(lesson.id);
                  const record = attendanceLookup.get(
                    `${student.id}-${lesson.id}`,
                  );
                  const isCancelled = lesson.status === "CANCELLED";

                  return (
                    <td
                      key={lesson.id}
                      className={`px-2 py-1 ${isCancelled ? "bg-muted/20" : ""}`}
                    >
                      <div className="flex justify-center">
                        {isCancelled ? (
                          <span className="text-muted-foreground text-xs">
                            &mdash;
                          </span>
                        ) : hasAttendance && record ? (
                          <AttendanceCell
                            attendanceId={record.id}
                            isAbsent={record.isAbsent}
                          />
                        ) : hasAttendance ? (
                          // Student wasn't in group for this lesson
                          <span className="text-muted-foreground text-xs">
                            &mdash;
                          </span>
                        ) : (
                          // No attendance initialized yet
                          <span className="text-muted-foreground text-xs">
                            &middot;
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Summary row — only show if any attendance exists */}
            {attendanceRecords.length > 0 && (
              <tr className="bg-muted/30 border-t">
                <td
                  className="bg-muted/50 text-muted-foreground sticky left-0 z-10 px-3 py-2 text-xs font-medium"
                  style={{ backgroundColor: "#fafafa" }}
                >
                  Absent
                </td>
                {sortedLessons.map((l) => (
                  <td
                    key={l.id}
                    className="text-muted-foreground px-2 py-2 text-center text-xs"
                  >
                    {attendanceStatusSet.has(l.id)
                      ? (absentCounts.get(l.id) ?? 0)
                      : ""}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Lesson detail dialog */}
      {selectedLesson && (
        <LessonDetailDialog
          lesson={selectedLesson}
          open={!!selectedLessonId}
          onOpenChange={(open) => {
            if (!open) setSelectedLessonId(null);
          }}
          groupType={groupType}
          cancellationReasons={cancellationReasons}
          studentCancellationsThisMonth={studentCancellationsThisMonth}
          hasAttendance={attendanceStatusSet.has(selectedLesson.id)}
          hasRecordings={(recordingCounts[selectedLesson.id] ?? 0) > 0}
        />
      )}
    </div>
  );
}
