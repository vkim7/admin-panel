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
import {
  LEVEL_SHORT,
  STAGE_SHORT,
  DAYS_LABEL,
  LEVEL_STAGE_ORDER,
} from "@/lib/constants";
import { getAge } from "@/lib/helpers/date";
import { getReceptionUrgency } from "@/lib/helpers/reception-staleness";
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


function getDaysLabel(days: number[]) {
  if (days.length === 0) return "Any";
  const key = days.join(",");
  return DAYS_LABEL[key] ?? days.join(",");
}

const URGENCY_CHIP_CLASS: Record<"red" | "amber" | "blue", string> = {
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
};

const LANG_SHORT: Record<string, string> = {
  UZBEK: "UZ",
  RUSSIAN: "RU",
  ANY: "Any",
};

function makeColumns(
  onAssign: (student: ReceptionStudent) => void,
  onSendToLost: (student: ReceptionStudent) => void,
): ColumnDef<ReceptionStudent>[] {
  return [
    {
      id: "urgency",
      header: "",
      enableSorting: false,
      meta: { cellClassName: "pr-10", headerClassName: "pr-10" },
      cell: ({ row }) => {
        const u = getReceptionUrgency(row.original.createdAt);
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_CHIP_CLASS[u.tier]}`}
          >
            {u.label}
          </span>
        );
      },
    },
    {
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      id: "name",
      header: "Name",
      enableSorting: false,
      meta: { cellClassName: "pr-10", headerClassName: "pr-10" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <Link
            href={`/students/${row.original.id}`}
            className="font-medium text-primary hover:underline leading-tight"
          >
            {row.original.firstName} {row.original.lastName}
          </Link>
          <span className="text-xs text-muted-foreground leading-tight">
            {row.original.phone}
          </span>
        </div>
      ),
    },
    {
      id: "age",
      header: "Age",
      meta: { cellClassName: "pr-10", headerClassName: "pr-10" },
      accessorFn: (row) => getAge(row.dateOfBirth),
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue<number>()}</span>
      ),
    },
    {
      id: "langType",
      header: "Lang · Type",
      enableSorting: false,
      meta: { cellClassName: "pr-10", headerClassName: "pr-10" },
      cell: ({ row }) => {
        const lang =
          LANG_SHORT[row.original.preferredLanguage] ??
          row.original.preferredLanguage;
        const type = LESSON_TYPE_LABELS[row.original.preferredLessonType];
        return (
          <span className="text-sm text-muted-foreground">
            {lang} · {type}
          </span>
        );
      },
    },
    {
      accessorKey: "level",
      header: ({ column }) => (
        <SortableHeader column={column}>Level</SortableHeader>
      ),
      meta: { cellClassName: "pr-10", headerClassName: "pr-10" },
      // Sort by curriculum progression (BEGINNER:BEGINNING through IELTS:FINAL)
      // rather than the default alphabetical sort which puts IELTS between
      // ELEMENTARY and INTERMEDIATE. Tie-break by createdAt asc so the
      // longest-waiting student in each level cluster surfaces first — this
      // tie-break is only deterministic because getReceptionStudents()'s
      // query also orders by createdAt asc; keep them aligned.
      // Unknown level+stage combinations fall to the bottom rather than
      // mysteriously floating to the top via indexOf returning -1.
      sortingFn: (a, b) => {
        const keyA = `${a.original.level}:${a.original.progressStage}`;
        const keyB = `${b.original.level}:${b.original.progressStage}`;
        const idxA = LEVEL_STAGE_ORDER.indexOf(keyA);
        const idxB = LEVEL_STAGE_ORDER.indexOf(keyB);
        const safeA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
        const safeB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
        const diff = safeA - safeB;
        if (diff !== 0) return diff;
        return (
          new Date(a.original.createdAt).getTime() -
          new Date(b.original.createdAt).getTime()
        );
      },
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {LEVEL_SHORT[row.original.level] ?? row.original.level}
          {" · "}
          {STAGE_SHORT[row.original.progressStage] ??
            row.original.progressStage}
        </Badge>
      ),
    },
    {
      id: "schedule",
      header: "Schedule",
      enableSorting: false,
      // Constrain to ~240px and allow wrapping — without this, a student with
      // every time slot selected would push the column to fill a third of the
      // table. `whitespace-normal` overrides TableCell's default
      // `whitespace-nowrap`.
      meta: {
        cellClassName: "pr-10 whitespace-normal min-w-[240px] max-w-[240px]",
        headerClassName: "pr-10",
      },
      cell: ({ row }) => {
        const days = getDaysLabel(row.original.preferredDays);
        const slots = row.original.preferredTimeSlots;
        const slotsLabel =
          slots.length > 0 ? [...slots].sort().join(", ") : "Any";
        return (
          <span className="text-sm">
            {days}
            <span className="text-muted-foreground">
              {" · "}
              {slotsLabel}
            </span>
          </span>
        );
      },
    },
    {
      accessorKey: "comment",
      header: "Comment",
      enableSorting: false,
      meta: {
        cellClassName: "w-full text-left align-top",
        headerClassName: "w-full text-left",
      },
      cell: ({ row }) => (
        <EditCommentDialog
          currentComment={row.original.comment}
          onSave={(c) => updateStudentComment(row.original.id, c)}
          displayMode="multiline"
        />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Actions"
            >
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

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        initialSorting={[{ id: "level", desc: false }]}
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
