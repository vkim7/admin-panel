"use client";

import { useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { toast } from "sonner";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LEVEL_SHORT, STAGE_SHORT } from "@/lib/constants";
import {
  AssignDialog,
  type GroupOption,
  type StudentForAssign,
} from "@/components/reception/assign-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { sendToReassignment } from "@/lib/actions/students";
import { ArrowRight, RefreshCw } from "lucide-react";
import type { LessonPreference } from "@eng/database";

type LostStudentRow = {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  level: string;
  progressStage: string;
  inactivatedAt: Date | null;
  otherLostReason: string | null;
  preferredDays: number[];
  preferredTimeSlots: string[];
  preferredLanguage: string;
  preferredLessonType: LessonPreference;
  lostReason: { id: string; name: string } | null;
  inactivatedBy: { firstName: string; lastName: string } | null;
  groupMemberships: {
    leaveDate: Date | null;
    group: { id: string; publicId: string };
  }[];
};

function makeColumns(
  onAssign: (student: LostStudentRow) => void,
  onReassign: (student: LostStudentRow) => void,
): ColumnDef<LostStudentRow>[] {
  return [
    {
      accessorKey: "crmCode",
      header: ({ column }) => (
        <SortableHeader column={column}>CRM</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.crmCode}</span>
      ),
    },
    {
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      id: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>Name</SortableHeader>
      ),
      cell: ({ row }) => (
        <Link
          href={`/students/${row.original.id}`}
          className="text-primary font-medium hover:underline"
        >
          {row.original.firstName} {row.original.lastName}
        </Link>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.phone}</span>
      ),
    },
    {
      accessorKey: "level",
      header: "Level",
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {LEVEL_SHORT[row.original.level] ?? row.original.level}
          {" \u00b7 "}
          {STAGE_SHORT[row.original.progressStage] ??
            row.original.progressStage}
        </Badge>
      ),
    },
    {
      id: "lostReason",
      header: "Reason",
      cell: ({ row }) => {
        const reason = row.original.lostReason;
        if (!reason)
          return (
            <span className="text-muted-foreground text-sm">{"\u2014"}</span>
          );
        const other = row.original.otherLostReason;
        return (
          <span className="text-sm" title={other ?? undefined}>
            {reason.name}
            {other && <span className="text-muted-foreground">: {other}</span>}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      id: "deactivatedAt",
      header: ({ column }) => (
        <SortableHeader column={column}>Deactivated</SortableHeader>
      ),
      accessorFn: (row) => row.inactivatedAt,
      cell: ({ row }) => {
        const date = row.original.inactivatedAt;
        if (!date)
          return (
            <span className="text-muted-foreground text-sm">{"\u2014"}</span>
          );
        return (
          <span className="text-sm">
            {new Date(date).toLocaleDateString("en-GB")}
          </span>
        );
      },
    },
    {
      id: "deactivatedBy",
      header: "By",
      cell: ({ row }) => {
        const admin = row.original.inactivatedBy;
        if (!admin)
          return (
            <span className="text-muted-foreground text-sm">{"\u2014"}</span>
          );
        return (
          <span className="text-muted-foreground text-sm">
            {admin.firstName} {admin.lastName}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      id: "lastGroup",
      header: "Last Group",
      cell: ({ row }) => {
        const membership = row.original.groupMemberships[0];
        if (!membership)
          return (
            <span className="text-muted-foreground text-sm">{"\u2014"}</span>
          );
        return (
          <Link
            href={`/groups/${membership.group.id}`}
            className="text-primary text-sm hover:underline"
          >
            {membership.group.publicId}
          </Link>
        );
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAssign(row.original)}
          >
            Assign
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReassign(row.original)}
          >
            <RefreshCw className="mr-1 size-3.5" />
            Reassign
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}

interface LostTableProps {
  data: LostStudentRow[];
  groups: GroupOption[];
}

export function LostTable({ data, groups }: LostTableProps) {
  const [selectedStudent, setSelectedStudent] =
    useState<StudentForAssign | null>(null);
  const [reassigningStudent, setReassigningStudent] =
    useState<LostStudentRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign(student: LostStudentRow) {
    setSelectedStudent({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      level: student.level,
      progressStage: student.progressStage,
      preferredDays: student.preferredDays,
      preferredTimeSlots: student.preferredTimeSlots,
      preferredLanguage: student.preferredLanguage,
      preferredLessonType: student.preferredLessonType,
    });
  }

  function handleReassign(student: LostStudentRow) {
    setReassigningStudent(student);
  }

  const columns = makeColumns(handleAssign, handleReassign);

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKey="name"
        searchPlaceholder="Search by name..."
      />

      {selectedStudent && (
        <AssignDialog
          student={selectedStudent}
          groups={groups}
          open={!!selectedStudent}
          onOpenChange={(open) => {
            if (!open) setSelectedStudent(null);
          }}
        />
      )}

      <ConfirmationDialog
        open={!!reassigningStudent}
        onOpenChange={(open) => {
          if (!open) setReassigningStudent(null);
        }}
        title="Send to Reassignment"
        description={`${reassigningStudent?.firstName} ${reassigningStudent?.lastName} will be moved to 'Awaiting Reassignment' status and appear on the Reassignment page for re-placement.`}
        confirmLabel="Send to Reassignment"
        variant="default"
        onConfirm={async () => {
          if (!reassigningStudent) return;
          startTransition(async () => {
            const result = await sendToReassignment(reassigningStudent.id);
            if (result?.error) {
              toast.error(result.error);
            } else {
              toast.success("Student sent to reassignment");
              setReassigningStudent(null);
            }
          });
        }}
      />
    </>
  );
}
