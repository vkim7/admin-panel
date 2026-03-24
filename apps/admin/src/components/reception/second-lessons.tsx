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
import type { SecondLessonRow } from "@/lib/queries/reception";

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US");
}

function PaymentStatusBadge({ status }: { status: string }) {
  if (status === "PARTIALLY_PAID") {
    return <Badge variant="outline" className="text-xs">Partial</Badge>;
  }
  return <Badge variant="destructive" className="text-xs">Unpaid</Badge>;
}

interface SecondLessonsProps {
  data: SecondLessonRow[];
}

export function SecondLessons({ data }: SecondLessonsProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No committed students with outstanding payments.</p>;
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
            <TableHead>Lessons</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const isUrgent = row.lessonsAttended >= 2;

            return (
              <TableRow
                key={row.membershipId}
                className={isUrgent ? "bg-destructive/10" : ""}
              >
                <TableCell className="font-mono">{row.crmCode}</TableCell>
                <TableCell>
                  <Link href={`/students/${row.studentId}`} className="font-medium text-primary hover:underline">
                    {row.studentName}
                  </Link>
                </TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell>
                  <Link href={`/groups/${row.groupId}`} className="text-muted-foreground hover:underline">
                    {row.groupPublicId}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className={isUrgent ? "font-medium text-destructive" : ""}>
                    {row.lessonsAttended}
                  </span>
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={row.paymentStatus} />
                </TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  {formatUZS(row.remaining)} UZS
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
