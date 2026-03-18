import { notFound } from "next/navigation";
import Link from "next/link";
import { getGroupById } from "@/lib/queries/groups";
import { getStudentsForGroupAssignment } from "@/lib/queries/students";
import {
  getLessonsForGroup,
  getCancellationReasons,
  getStudentCancellationCount,
  getTeachersForGroupReassignment,
} from "@/lib/queries/lessons";
import { getProgressStage } from "@/lib/helpers/lesson-generation";
import { StudentList } from "@/components/groups/student-list";
import { AddStudentDialog } from "@/components/groups/add-student-dialog";
import { LessonList } from "@/components/lessons/lesson-list";
import { TeacherChangeDialog } from "@/components/lessons/teacher-change-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, AlertTriangle } from "lucide-react";
import { DAY_SHORT, LEVEL_LABEL } from "@/lib/constants";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroupById(id);
  if (!group) notFound();

  const [lessons, cancellationReasons, reassignmentTeachers] = await Promise.all([
    getLessonsForGroup(id),
    getCancellationReasons(),
    getTeachersForGroupReassignment(id),
  ]);

  // Get student cancellation count for current month (for INDIVIDUAL groups)
  const now = new Date();
  const studentCancellationsThisMonth =
    group.type === "INDIVIDUAL"
      ? await getStudentCancellationCount(id, now.getUTCFullYear(), now.getUTCMonth() + 1)
      : 0;

  const activeMemberships = group.memberships.filter((m) => !m.leaveDate);
  const hasCapacity = activeMemberships.length < group.maxStudents;

  // Check for stale trials
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const staleTrials = activeMemberships.filter(
    (m) => m.isTrial && m.joinDate < today,
  );

  // Lesson summary
  const scheduled = lessons.filter((l) => l.status === "SCHEDULED").length;
  const completed = lessons.filter((l) => l.status === "COMPLETED").length;
  const cancelled = lessons.filter((l) => l.status === "CANCELLED").length;
  const total = lessons.length;

  // Compute progress stage dynamically
  const progressStage = getProgressStage(group.startDate, group.endDate);

  // Students available for assignment
  const availableStudents = await getStudentsForGroupAssignment(id);

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title={group.publicId}
        breadcrumbs={[
          { label: "Groups", href: "/groups" },
          { label: group.publicId },
        ]}
        actions={
          <div className="flex gap-2">
            {group.isActive && hasCapacity && (
              <AddStudentDialog groupId={id} students={availableStudents} />
            )}
            {group.isActive && (
              <TeacherChangeDialog groupId={id} teachers={reassignmentTeachers} />
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/groups/${id}/edit`}>
                <Pencil className="mr-1 size-4" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />

      {!group.isActive && <Badge variant="destructive">Inactive</Badge>}

      {/* Stale trial alert */}
      {staleTrials.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {staleTrials.length} trial{staleTrials.length > 1 ? "s" : ""} need
            resolution:{" "}
            {staleTrials
              .map(
                (m) => `${m.student.firstName} ${m.student.lastName}`,
              )
              .join(", ")}
          </span>
        </div>
      )}

      {/* Group Info */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Type</p>
          <p className="mt-1 text-sm">
            {group.type === "INDIVIDUAL" ? "Individual" : "Group"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Level</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">
              {LEVEL_LABEL[group.level] ?? group.level}
            </Badge>
            <StatusBadge type="group" value={progressStage} />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Teacher</p>
          <p className="mt-1 text-sm">
            <Link
              href={`/teachers/${group.teacher.id}`}
              className="text-primary hover:underline"
            >
              {group.teacher.firstName} {group.teacher.lastName}
            </Link>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Schedule</p>
          <p className="mt-1 text-sm">
            {group.days.map((d: number) => DAY_SHORT[d]).join("/")} at{" "}
            {group.startTime} ({group.durationMinutes} min)
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Period</p>
          <p className="mt-1 text-sm">
            {new Date(group.startDate).toLocaleDateString("en-GB")} —{" "}
            {new Date(group.endDate).toLocaleDateString("en-GB")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Students</p>
          <p className="mt-1 text-sm">
            {activeMemberships.length}/{group.maxStudents}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Lessons</p>
          <p className="mt-1 text-sm">
            {total} total ({scheduled} scheduled, {completed} completed
            {cancelled > 0 ? `, ${cancelled} cancelled` : ""})
          </p>
        </div>
        {group.zoomLink && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Zoom Link
            </p>
            <a
              href={group.zoomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-sm text-primary hover:underline"
            >
              Open Zoom
            </a>
          </div>
        )}
      </div>

      <Separator />

      {/* Students */}
      <StudentList memberships={group.memberships} groupId={id} />

      <Separator />

      {/* Lessons */}
      <LessonList
        lessons={lessons}
        groupId={id}
        groupType={group.type}
        cancellationReasons={cancellationReasons}
        studentCancellationsThisMonth={studentCancellationsThisMonth}
      />

      <Separator />

      {/* Teacher History */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Teacher History</h3>
        {group.teacherHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history.</p>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Teacher</th>
                  <th className="px-3 py-2 text-left font-medium">From</th>
                  <th className="px-3 py-2 text-left font-medium">To</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Changed By
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.teacherHistory.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="px-3 py-2">
                      {h.teacher.firstName} {h.teacher.lastName}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(h.startDate).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-3 py-2">
                      {h.endDate
                        ? new Date(h.endDate).toLocaleDateString("en-GB")
                        : "Current"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {h.changedBy
                        ? `${h.changedBy.firstName} ${h.changedBy.lastName}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
