"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LEVEL_SHORT, STAGE_SHORT, DAYS_LABEL } from "@/lib/constants";
import { getAge } from "@/lib/helpers/date";
import {
  AssignDialog,
  type GroupOption,
  type StudentForAssign,
} from "./assign-dialog";
import { ArrowRight } from "lucide-react";

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
  comment: string | null;
  family: { parentPhone: string | null } | null;
};

function getDaysLabel(days: number[]) {
  if (days.length === 0) return "—";
  const key = days.join(",");
  return DAYS_LABEL[key] ?? days.join(",");
}

function makeColumns(
  onAssign: (student: ReceptionStudent) => void,
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
      cell: ({ row }) => {
        const comment = row.original.comment;
        if (!comment) return null;
        return (
          <span
            className="max-w-[200px] truncate text-sm text-foreground"
            title={comment}
          >
            {comment}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      id: "assign",
      header: "",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAssign(row.original)}
        >
          Assign
          <ArrowRight className="ml-1 size-3.5" />
        </Button>
      ),
      enableSorting: false,
    },
  ];
}

interface ReceptionTableProps {
  data: ReceptionStudent[];
  groups: GroupOption[];
}

export function ReceptionTable({ data, groups }: ReceptionTableProps) {
  const [selectedStudent, setSelectedStudent] =
    useState<StudentForAssign | null>(null);
  const [search, setSearch] = useState("");

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
    });
  }

  const columns = makeColumns(handleAssign);

  const filtered = search
    ? data.filter((s) => {
        const q = search.toLowerCase();
        const name = `${s.firstName} ${s.lastName}`.toLowerCase();
        const phone = s.phone.toLowerCase();
        const parentPhone = s.family?.parentPhone?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || parentPhone.includes(q);
      })
    : data;

  return (
    <>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
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
    </>
  );
}
