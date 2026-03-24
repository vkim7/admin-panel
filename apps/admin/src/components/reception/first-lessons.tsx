"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TrialActionsMenu } from "@/components/groups/trial-resolution-dialog";
import { DAYS_LABEL } from "@/lib/constants";
import type { FirstLessonRow } from "@/lib/queries/reception";
import type { LostReason } from "@/lib/queries/students";
import type { TransferGroup } from "@/lib/queries/transfers";

function AttendanceBadge({ status }: { status: FirstLessonRow["attendanceStatus"] }) {
  switch (status) {
    case "attended":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Attended</Badge>;
    case "absent":
      return <Badge variant="destructive">Absent</Badge>;
    case "no_record":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">No record</Badge>;
    case "upcoming":
      return <Badge variant="secondary">Upcoming</Badge>;
  }
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

interface FirstLessonsProps {
  data: FirstLessonRow[];
  lostReasons: LostReason[];
  transferGroups: TransferGroup[];
}

export function FirstLessons({ data, lostReasons, transferGroups }: FirstLessonsProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No trial students pending follow-up.</p>;
  }

  return (
    <div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">CRM</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Lesson</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 w-10">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const daysKey = row.groupDays.join(",");
              const daysLabel = DAYS_LABEL[daysKey] ?? daysKey;
              const otherGroups = transferGroups.filter((g) => g.id !== row.groupId);

              return (
                <tr key={row.membershipId} className="border-b last:border-b-0">
                  <td className="px-3 py-2 text-muted-foreground">{row.crmCode}</td>
                  <td className="px-3 py-2">
                    <Link href={`/students/${row.studentId}`} className="text-primary hover:underline">
                      {row.studentName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/groups/${row.groupId}`} className="text-muted-foreground hover:underline">
                      {row.groupPublicId}
                    </Link>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {daysLabel} {row.groupStartTime}
                    </span>
                  </td>
                  <td className="px-3 py-2">{formatDate(row.lessonDate)}</td>
                  <td className="px-3 py-2">
                    <AttendanceBadge status={row.attendanceStatus} />
                  </td>
                  <td className="px-3 py-2">
                    <TrialActionsMenu
                      membershipId={row.membershipId}
                      studentId={row.studentId}
                      studentName={row.studentName}
                      groupType={row.groupType}
                      hasAttendance={row.attendanceStatus === "attended" || row.attendanceStatus === "absent"}
                      lostReasons={lostReasons}
                      availableGroups={otherGroups}
                      currentGroupPublicId={row.groupPublicId}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
