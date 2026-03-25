"use client";

import { useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { toast } from "sonner";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LEVEL_SHORT, STAGE_SHORT, DAYS_LABEL } from "@/lib/constants";
import {
  AssignDialog,
  type GroupOption,
  type StudentForAssign,
} from "@/components/reception/assign-dialog";
import { deactivateStudent, updateStudentComment } from "@/lib/actions/students";
import { ArrowRight, UserMinus } from "lucide-react";
import { EditCommentDialog } from "@/components/shared/edit-comment-dialog";

type LostReason = {
  id: string;
  name: string;
  isOther: boolean;
};

type ReassignmentStudent = {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  level: string;
  progressStage: string;
  createdAt: Date;
  preferredDays: number[];
  preferredTimeSlots: string[];
  preferredLanguage: string;
  comment: string | null;
  groupMemberships: {
    leaveDate: Date | null;
    group: { id: string; publicId: string };
  }[];
};

function getDaysLabel(days: number[]) {
  if (days.length === 0) return "\u2014";
  const key = days.join(",");
  return DAYS_LABEL[key] ?? days.join(",");
}

function makeColumns(
  onAssign: (student: ReassignmentStudent) => void,
  onDeactivate: (student: ReassignmentStudent) => void,
): ColumnDef<ReassignmentStudent>[] {
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
          className="font-medium text-primary hover:underline"
        >
          {row.original.firstName} {row.original.lastName}
        </Link>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
    },
    {
      accessorKey: "level",
      header: "Level",
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {LEVEL_SHORT[row.original.level] ?? row.original.level}
          {" \u00b7 "}
          {STAGE_SHORT[row.original.progressStage] ?? row.original.progressStage}
        </Badge>
      ),
    },
    {
      id: "previousGroup",
      header: "Previous Group",
      cell: ({ row }) => {
        const membership = row.original.groupMemberships[0];
        if (!membership) return <span className="text-sm text-muted-foreground">{"\u2014"}</span>;
        return (
          <Link
            href={`/groups/${membership.group.id}`}
            className="text-sm text-primary hover:underline"
          >
            {membership.group.publicId}
          </Link>
        );
      },
      enableSorting: false,
    },
    {
      id: "preferredDays",
      header: "Days",
      cell: ({ row }) => (
        <span className="text-sm">
          {getDaysLabel(row.original.preferredDays)}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "preferredTime",
      header: "Time",
      cell: ({ row }) => {
        const slots = row.original.preferredTimeSlots;
        if (slots.length === 0) return <span className="text-sm text-muted-foreground">{"\u2014"}</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {slots.map((slot) => (
              <span
                key={slot}
                className="rounded border bg-muted px-1.5 py-0.5 text-xs"
              >
                {slot}
              </span>
            ))}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "comment",
      header: "Comment",
      cell: ({ row }) => (
        <EditCommentDialog
          currentComment={row.original.comment}
          onSave={(c) => updateStudentComment(row.original.id, c)}
        />
      ),
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
            className="text-destructive hover:text-destructive"
            onClick={() => onDeactivate(row.original)}
          >
            <UserMinus className="size-3.5" />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}

interface ReassignmentTableProps {
  data: ReassignmentStudent[];
  groups: GroupOption[];
  lostReasons: LostReason[];
}

export function ReassignmentTable({ data, groups, lostReasons }: ReassignmentTableProps) {
  const [selectedStudent, setSelectedStudent] = useState<StudentForAssign | null>(null);
  const [deactivatingStudent, setDeactivatingStudent] = useState<ReassignmentStudent | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedReason = lostReasons.find((r) => r.id === selectedReasonId);

  function handleAssign(student: ReassignmentStudent) {
    setSelectedStudent({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      level: student.level,
      progressStage: student.progressStage,
      preferredDays: student.preferredDays,
      preferredTimeSlots: student.preferredTimeSlots,
      preferredLanguage: student.preferredLanguage,
    });
  }

  function handleDeactivate(student: ReassignmentStudent) {
    setDeactivatingStudent(student);
    setSelectedReasonId("");
    setOtherReason("");
  }

  const columns = makeColumns(handleAssign, handleDeactivate);

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

      <Dialog
        open={!!deactivatingStudent}
        onOpenChange={(open) => {
          if (!open) setDeactivatingStudent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Student</DialogTitle>
            <DialogDescription>
              This will mark {deactivatingStudent?.firstName} {deactivatingStudent?.lastName} as inactive. Please select a reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason for leaving</Label>
              <Select onValueChange={setSelectedReasonId} value={selectedReasonId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {lostReasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedReason?.isOther && (
              <div className="space-y-2">
                <Label>Please specify</Label>
                <Textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Why is the student leaving?"
                  rows={2}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivatingStudent(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!selectedReasonId || isPending}
              onClick={() => {
                if (!deactivatingStudent) return;
                startTransition(async () => {
                  const result = await deactivateStudent(deactivatingStudent.id, {
                    lostReasonId: selectedReasonId,
                    otherLostReason: otherReason || null,
                  });
                  if (result?.error) {
                    toast.error(result.error);
                  } else if ("success" in result) {
                    toast.success("Student deactivated");
                    setDeactivatingStudent(null);
                  }
                });
              }}
            >
              {isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
