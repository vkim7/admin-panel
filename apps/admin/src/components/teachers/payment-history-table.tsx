"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteTeacherPaymentPeriod } from "@/lib/actions/teacher-payments";
import { MONTH_NAMES } from "@/lib/constants";

type PaymentRow = {
  id: string;
  periodMonth: number;
  periodYear: number;
  group: { id: string; publicId: string };
  lessonsCompleted: number;
  totalStudentLessons: number;
  rate: number;
  amount: number;
  status: string;
};

export function PaymentHistoryTable({
  payments,
}: {
  payments: PaymentRow[];
}) {
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteTeacherPaymentPeriod({ id: deleteTarget.id });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Payment record deleted");
      }
      setDeleteTarget(null);
    });
  }

  return (
    <>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Period</th>
              <th className="px-3 py-2 text-left font-medium">Group</th>
              <th className="px-3 py-2 text-left font-medium">Lessons</th>
              <th className="px-3 py-2 text-left font-medium">Std-Lessons</th>
              <th className="px-3 py-2 text-left font-medium">Rate</th>
              <th className="px-3 py-2 text-left font-medium">Amount</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  {MONTH_NAMES[p.periodMonth]} {p.periodYear}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/groups/${p.group.id}`} className="hover:underline">
                    {p.group.publicId}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.lessonsCompleted}</td>
                <td className="px-3 py-2">{p.totalStudentLessons}</td>
                <td className="px-3 py-2">{p.rate.toLocaleString("en-US")}</td>
                <td className="px-3 py-2">{p.amount.toLocaleString("en-US")} UZS</td>
                <td className="px-3 py-2">
                  <StatusBadge type="teacherPay" value={p.status} className="text-xs" />
                </td>
                <td className="px-3 py-2 text-right">
                  {p.status === "UNPAID" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(p)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Payment Record"
        description={
          deleteTarget
            ? `This will delete the unpaid payment record for ${deleteTarget.group.publicId} (${MONTH_NAMES[deleteTarget.periodMonth]} ${deleteTarget.periodYear}). You can regenerate it by clicking "Generate Pay".`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </>
  );
}
