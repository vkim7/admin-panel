"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { PeriodEditor } from "./period-editor";
import type { StudentPaymentPeriodWithDetails } from "@/lib/queries/payments";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const METHOD_LABEL: Record<string, string> = {
  click: "Click",
  payme: "Payme",
  cash: "Cash",
};

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US");
}

function PaymentStatusBadge({ status }: { status: string }) {
  const variant = status === "PAID" ? "default" : status === "PARTIALLY_PAID" ? "outline" : "destructive";
  const label = status === "PAID" ? "Paid" : status === "PARTIALLY_PAID" ? "Partial" : "Unpaid";
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}

function PeriodCard({
  period,
  studentName,
}: {
  period: StudentPaymentPeriodWithDetails;
  studentName: string;
}) {
  const effective = period.amountDue - period.discountAmount;
  const remaining = effective - period.amountPaid;
  const periodLabel = `${MONTH_NAMES[period.periodMonth]} ${period.periodYear}`;

  return (
    <div className="rounded-md border">
      {/* Period header */}
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{periodLabel}</span>
          <Link href={`/groups/${period.group.id}`} className="text-xs text-muted-foreground hover:underline">
            {period.group.publicId}
          </Link>
          {period.isPartialPeriod && (
            <Badge variant="outline" className="text-xs">Prorated</Badge>
          )}
          {period.paymentStatus === "PARTIALLY_PAID" && (
            <PaymentStatusBadge status={period.paymentStatus} />
          )}
        </div>
        <div className="flex items-center gap-1">
          {period.paymentStatus !== "PAID" && (
            <RecordPaymentDialog
              periodId={period.id}
              studentName={studentName}
              amountDue={period.amountDue}
              discountAmount={period.discountAmount}
              amountPaid={period.amountPaid}
              trigger={
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Plus className="size-4" />
                </Button>
              }
            />
          )}
          <PeriodEditor
            periodId={period.id}
            studentName={studentName}
            groupPublicId={period.group.publicId}
            periodLabel={periodLabel}
            totalLessons={period.totalLessons}
            amountDue={period.amountDue}
            discountAmount={period.discountAmount}
          />
        </div>
      </div>

      {/* Period details */}
      <div className="grid grid-cols-5 gap-2 px-3 py-2 text-sm">
        <div>
          <span className="text-xs text-muted-foreground">Lessons</span>
          <p>{period.totalLessons}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Due</span>
          <p>{formatUZS(period.amountDue)}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Discount</span>
          <p>{period.discountAmount > 0 ? formatUZS(period.discountAmount) : "—"}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Paid</span>
          <p>{period.amountPaid > 0 ? formatUZS(period.amountPaid) : "—"}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Remaining</span>
          <p className={remaining > 0 ? "font-medium text-destructive" : ""}>
            {remaining > 0 ? formatUZS(remaining) : "—"}
          </p>
        </div>
      </div>

      {/* Payments */}
      {period.payments.length > 0 && (
        <div className="border-t px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Payments</p>
          <div className="space-y-1">
            {period.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{formatUZS(payment.amount)} UZS</span>
                  {payment.isTransferCredit ? (
                    <Badge variant="secondary" className="text-xs">Transfer credit</Badge>
                  ) : payment.paymentMethod && (
                    <Badge variant="outline" className="text-xs">
                      {METHOD_LABEL[payment.paymentMethod] ?? payment.paymentMethod}
                    </Badge>
                  )}
                  {payment.note && (
                    <span className="text-xs text-muted-foreground">{payment.note}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(payment.paidAt).toLocaleDateString("en-GB")}
                  {payment.recordedBy && (
                    <> · {payment.recordedBy.firstName} {payment.recordedBy.lastName}</>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adjustments */}
      {period.adjustments.length > 0 && (
        <div className="border-t bg-muted/30 px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Adjustments</p>
          <div className="space-y-1">
            {period.adjustments.map((adj) => (
              <div key={adj.id} className="text-xs text-muted-foreground">
                <span className="font-medium">{adj.type}</span>
                {" — "}
                {adj.previousAmountDue !== adj.newAmountDue && (
                  <span>Due: {formatUZS(adj.previousAmountDue)} → {formatUZS(adj.newAmountDue)} </span>
                )}
                {adj.previousTotalLessons !== adj.newTotalLessons && (
                  <span>Lessons: {adj.previousTotalLessons} → {adj.newTotalLessons} </span>
                )}
                {adj.reason && <span>({adj.reason})</span>}
                <span className="ml-2">
                  {new Date(adj.createdAt).toLocaleDateString("en-GB")}
                  {adj.adjustedBy && ` · ${adj.adjustedBy.firstName} ${adj.adjustedBy.lastName}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function sortAsc(a: StudentPaymentPeriodWithDetails, b: StudentPaymentPeriodWithDetails) {
  return a.periodYear - b.periodYear || a.periodMonth - b.periodMonth;
}

function sortDesc(a: StudentPaymentPeriodWithDetails, b: StudentPaymentPeriodWithDetails) {
  return b.periodYear - a.periodYear || b.periodMonth - a.periodMonth;
}

interface PaymentHistoryProps {
  periods: StudentPaymentPeriodWithDetails[];
  studentName: string;
}

export function PaymentHistory({ periods, studentName }: PaymentHistoryProps) {
  if (periods.length === 0) {
    return <p className="text-sm text-muted-foreground">No billing periods yet.</p>;
  }

  const unpaid = periods.filter((p) => p.paymentStatus !== "PAID").sort(sortAsc);
  const paid = periods.filter((p) => p.paymentStatus === "PAID").sort(sortDesc);

  return (
    <div className="space-y-4">
      {/* Unpaid periods — always visible, sorted closest first */}
      {unpaid.map((period) => (
        <PeriodCard key={period.id} period={period} studentName={studentName} />
      ))}

      {/* Paid periods — collapsible, sorted newest first */}
      {paid.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Paid ({paid.length})
          </summary>
          <div className="mt-2 space-y-4">
            {paid.map((period) => (
              <PeriodCard key={period.id} period={period} studentName={studentName} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
