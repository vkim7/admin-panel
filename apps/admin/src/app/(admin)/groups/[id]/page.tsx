import { notFound } from "next/navigation";
import Link from "next/link";
import { getGroupById } from "@/lib/queries/groups";
import { getStudentsForGroupAssignment, getTrialMembershipAttendance } from "@/lib/queries/students";
import {
  getLessonsForGroup,
  getCancellationReasons,
  getStudentCancellationCount,
  getTeachersForGroupReassignment,
} from "@/lib/queries/lessons";
import {
  getAttendanceForGroup,
  getLessonAttendanceStatus,
} from "@/lib/queries/attendance";
import {
  getTransferReasons,
  getGroupsForTransfer,
} from "@/lib/queries/transfers";
import { getGroupsForMerge } from "@/lib/queries/group-merge";
import { getLostReasons, getUncertainReasons } from "@/lib/queries/students";
import { getProgressStage } from "@/lib/helpers/lesson-generation";
import { canGraduate } from "@/lib/helpers/level-progression";
import { StudentList } from "@/components/groups/student-list";
import { AddStudentDialog } from "@/components/groups/add-student-dialog";
import { MergeDialog } from "@/components/groups/merge-dialog";
import { GraduationDialog } from "@/components/groups/graduation-dialog";
import { LessonGrid } from "@/components/lessons/lesson-grid";
import { TeacherChangeDialog } from "@/components/lessons/teacher-change-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, AlertTriangle } from "lucide-react";
import { DAY_SHORT, LEVEL_LABEL, MONTH_NAMES } from "@/lib/constants";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroupById(id);
  if (!group) notFound();

  const [lessons, cancellationReasons, reassignmentTeachers, attendanceRecords, lessonAttendanceStatus, transferReasons, transferGroups, mergeGroups, lostReasons, uncertainReasons] = await Promise.all([
    getLessonsForGroup(id),
    getCancellationReasons(),
    getTeachersForGroupReassignment(id),
    getAttendanceForGroup(id),
    getLessonAttendanceStatus(id),
    getTransferReasons(),
    getGroupsForTransfer(id),
    getGroupsForMerge(id),
    getLostReasons(),
    getUncertainReasons(),
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

  const total = lessons.length;

  // Group lessons by month for the breakdown
  const lessonsByMonth: { label: string; count: number }[] = [];
  const monthMap = new Map<string, number>();
  for (const lesson of lessons) {
    const d = new Date(lesson.lessonDate);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }
  for (const [key, count] of [...monthMap.entries()].sort()) {
    const [y, m] = key.split("-");
    lessonsByMonth.push({ label: MONTH_NAMES[parseInt(m!, 10)]!, count });
  }

  // Compute progress stage dynamically
  const progressStage = getProgressStage(group.startDate, group.endDate);

  // Students available for assignment
  const availableStudents = await getStudentsForGroupAssignment(id);

  // Derive trial attendance scoped to each membership's date window
  const trialMemberships = group.memberships
    .filter((m) => m.wasTrialOriginally)
    .map((m) => ({
      id: m.id,
      studentId: m.student.id,
      groupId: id,
      joinDate: m.joinDate,
      leaveDate: m.leaveDate,
    }));
  const trialMembershipIdsWithAttendance = await getTrialMembershipAttendance(
    trialMemberships,
  );

  // Check graduation eligibility
  const graduationEligibility = canGraduate({
    level: group.level,
    isActive: group.isActive,
    skipAutoGraduation: group.skipAutoGraduation,
    lessons: group.lessons,
  });

  // Active members for the lesson grid
  const activeMembers = activeMemberships.map((m) => ({
    id: m.student.id,
    crmCode: m.student.crmCode,
    firstName: m.student.firstName,
    lastName: m.student.lastName,
  }));

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
            {group.isActive && activeMemberships.length > 0 && (
              <MergeDialog
                sourceGroupId={id}
                sourceGroupPublicId={group.publicId}
                activeStudentCount={activeMemberships.length}
                availableGroups={mergeGroups}
              />
            )}
            {graduationEligibility.eligible && (
              <GraduationDialog
                groupId={id}
                groupPublicId={group.publicId}
                lostReasons={lostReasons}
              />
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
          <p className="text-xs font-medium text-muted-foreground">Lessons ({total})</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {lessonsByMonth.map((m) => (
              <span
                key={m.label}
                className="rounded-md bg-muted px-1.5 py-0.5 text-xs"
              >
                {m.label} · {m.count}
              </span>
            ))}
          </div>
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
      <StudentList
        memberships={group.memberships}
        groupId={id}
        groupType={group.type}
        currentGroupPublicId={group.publicId}
        transferReasons={transferReasons}
        availableGroups={transferGroups}
        trialMembershipIdsWithAttendance={trialMembershipIdsWithAttendance}
        lostReasons={lostReasons}
        uncertainReasons={uncertainReasons}
      />

      <Separator />

      {/* Lessons + Attendance Grid */}
      <LessonGrid
        lessons={lessons}
        groupId={id}
        groupType={group.type}
        cancellationReasons={cancellationReasons}
        studentCancellationsThisMonth={studentCancellationsThisMonth}
        attendanceRecords={attendanceRecords}
        lessonAttendanceStatus={lessonAttendanceStatus}
        activeMembers={activeMembers}
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
