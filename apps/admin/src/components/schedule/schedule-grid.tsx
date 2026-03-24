import Link from "next/link";
import type { ScheduleTeacherRow } from "@/lib/queries/schedule";
import { TIME_SLOTS } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScheduleCell } from "./schedule-cell";
import { Plus } from "lucide-react";

export function ScheduleGrid({
  teachers,
  days,
}: {
  teachers: ScheduleTeacherRow[];
  days: string; // "1,3,5" or "2,4,6"
}) {
  return (
    <div className="space-y-3">
      {teachers.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No groups scheduled
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background min-w-[140px]">
                Teacher
              </TableHead>
              {TIME_SLOTS.map((slot) => (
                <TableHead key={slot} className="min-w-[120px]">
                  {slot}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.map((teacher) => (
              <TableRow key={teacher.id}>
                <TableCell className="sticky left-0 z-10 bg-background font-medium">
                  <Link
                    href={`/teachers/${teacher.id}`}
                    className="text-primary hover:underline"
                  >
                    {teacher.name}
                  </Link>
                </TableCell>
                {TIME_SLOTS.map((slot) => {
                  const cell = teacher.slots[slot];
                  const isAvailable = teacher.availableSlots.includes(slot);
                  return (
                    <TableCell key={slot}>
                      {cell ? (
                        <ScheduleCell cell={cell} />
                      ) : isAvailable ? (
                        <Link
                          href={`/groups/new?teacherId=${teacher.id}&days=${days}&startTime=${slot}`}
                          className="flex h-[70px] items-center justify-center rounded-md border border-dashed bg-muted/10 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                        >
                          <Plus className="size-4" />
                        </Link>
                      ) : (
                        <div className="h-[70px] rounded-md bg-muted/10" />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
