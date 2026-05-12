"use client";

import { useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { toast } from "sonner";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getAge } from "@/lib/helpers/date";
import {
  AssignDialog,
  type GroupOption,
  type StudentForAssign,
} from "./assign-dialog";
import { MoreHorizontal } from "lucide-react";
import { EditCommentDialog } from "@/components/shared/edit-comment-dialog";
import { updateStudentComment, sendOrphanToLost } from "@/lib/actions/students";
import type { LostReason } from "@/lib/queries/students";
import type { LessonPreference } from "@eng/database";

type ReceptionStudent = {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: Date;
  level: string;
  progressStage: string;
  createdAt: Date;
  preferredDays: number[];
  preferredTimeSlots: string[];
  preferredLanguage: string;
  preferredLessonType: LessonPreference;
  comment: string | null;
  family: { parentPhone: string | null } | null;
};

const LESSON_TYPE_LABELS: Record<LessonPreference, string> = {
  GROUP: "Group",
  INDIVIDUAL: "Individual",
  EITHER: "Either",
};

type LessonTypeFilter = "ALL" | LessonPreference;

function getDaysLabel(days: number[]) {
  if (days.length === 0) return "—";
  const key = days.join(",");
  return DAYS_LABEL[key] ?? days.join(",");
}

function makeColumns(
  onAssign: (student: ReceptionStudent) => void,
  onSendToLost: (student: ReceptionStudent) => void,
): ColumnDef<ReceptionStudent>[] {
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
      id: "age",
      header: "Age",
      accessorFn: (row) => getAge(row.dateOfBirth),
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue<number>()}</span>
      ),
    },
    {
      accessorKey: "level",
      header: "Level",
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {LEVEL_SHORT[row.original.level] ?? row.original.level}
          {" · "}
          {STAGE_SHORT[row.original.progressStage] ?? row.original.progressStage}
        </Badge>
      ),
    },
    {
      accessorKey: "preferredLessonType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {LESSON_TYPE_LABELS[row.original.preferredLessonType]}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortableHeader column={column}>Created</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
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
        if (slots.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onAssign(row.original)}>
              Assign
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onSendToLost(row.original)}
            >
              Send to Lost list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
    },
  ];
}

interface ReceptionTableProps {
  data: ReceptionStudent[];
  groups: GroupOption[];
  lostReasons: LostReason[];
}

type StudentForLost = {
  id: string;
  firstName: string;
  lastName: string;
};

export function ReceptionTable({ data, groups, lostReasons }: ReceptionTableProps) {
  const [selectedStudent, setSelectedStudent] =
    useState<StudentForAssign | null>(null);
  const [lostStudent, setLostStudent] = useState<StudentForLost | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<LessonTypeFilter>("ALL");

  const selectedReason = lostReasons.find((r) => r.id === selectedReasonId);

  function handleAssign(student: ReceptionStudent) {
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

  function handleSendToLost(student: ReceptionStudent) {
    setLostStudent({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
    });
  }

  function resetLostDialog() {
    setLostStudent(null);
    setSelectedReasonId("");
    setOtherReason("");
  }

  function submitLost() {
    if (!lostStudent) return;
    startTransition(async () => {
      const result = await sendOrphanToLost(lostStudent.id, {
        lostReasonId: selectedReasonId,
        otherLostReason: selectedReason?.isOther ? otherReason : null,
      });
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${lostStudent.firstName} ${lostStudent.lastName} sent to Lost list`);
        resetLostDialog();
      }
    });
  }

  const columns = makeColumns(handleAssign, handleSendToLost);

  const filtered = data.filter((s) => {
    if (typeFilter !== "ALL" && s.preferredLessonType !== typeFilter) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      const phone = s.phone.toLowerCase();
      const parentPhone = s.family?.parentPhone?.toLowerCase() ?? "";
      if (!name.includes(q) && !phone.includes(q) && !parentPhone.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const TYPE_FILTERS: { value: LessonTypeFilter; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "GROUP", label: "Group" },
    { value: "INDIVIDUAL", label: "Individual" },
    { value: "EITHER", label: "Either" },
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex gap-1">
            {TYPE_FILTERS.map((opt) => {
              const selected = typeFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTypeFilter(opt.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
        />
      </div>
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
        open={!!lostStudent}
        onOpenChange={(open) => {
          if (!open) resetLostDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Send to Lost list
              {lostStudent && ` — ${lostStudent.firstName} ${lostStudent.lastName}`}
            </DialogTitle>
            <DialogDescription>
              The student will be marked inactive and moved to the Lost list. This cannot be undone from this screen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason</Label>
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
                  placeholder="Why is the student lost?"
                  rows={2}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetLostDialog} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                !selectedReasonId ||
                isPending ||
                (!!selectedReason?.isOther && !otherReason.trim())
              }
              onClick={submitLost}
            >
              {isPending ? "..." : "Send to Lost list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
