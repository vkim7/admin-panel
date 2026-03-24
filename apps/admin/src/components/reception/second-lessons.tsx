"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
    <div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">CRM</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Lessons</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isUrgent = row.lessonsAttended >= 2;

              return (
                <tr
                  key={row.membershipId}
                  className={`border-b last:border-b-0 ${isUrgent ? "bg-destructive/10" : ""}`}
                >
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
                  </td>
                  <td className="px-3 py-2">
                    <span className={isUrgent ? "font-medium text-destructive" : ""}>
                      {row.lessonsAttended}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <PaymentStatusBadge status={row.paymentStatus} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-destructive">
                    {formatUZS(row.remaining)} UZS
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
