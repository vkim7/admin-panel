"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrialActionsMenu } from "@/components/groups/trial-resolution-dialog";
import { CopyZoomButton } from "@/components/copy-zoom-button";
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CRM</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Lesson</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const daysKey = row.groupDays.join(",");
            const daysLabel = DAYS_LABEL[daysKey] ?? daysKey;
            const otherGroups = transferGroups.filter((g) => g.id !== row.groupId);

            return (
              <TableRow key={row.membershipId}>
                <TableCell className="font-mono">{row.crmCode}</TableCell>
                <TableCell>
                  <Link href={`/students/${row.studentId}`} className="font-medium text-primary hover:underline">
                    {row.studentName}
                  </Link>
                </TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Link href={`/groups/${row.groupId}`} className="text-muted-foreground hover:underline">
                      {row.groupPublicId}
                    </Link>
                    <CopyZoomButton zoomLink={row.zoomJoinUrl} />
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {daysLabel} {row.groupStartTime}
                </TableCell>
                <TableCell>{formatDate(row.lessonDate)}</TableCell>
                <TableCell>
                  <AttendanceBadge status={row.attendanceStatus} />
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
