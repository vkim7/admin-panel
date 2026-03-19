import type { TeacherPaySummary } from "@/lib/queries/teacher-payments";

function formatUZS(amount: number) {
  return amount.toLocaleString("en-US");
}

interface PaySummaryCardsProps {
  summary: TeacherPaySummary;
}

export function PaySummaryCards({ summary }: PaySummaryCardsProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border px-4 py-2.5 text-sm">
      <span>
        <span className="text-muted-foreground">Total</span>
        <span className="ml-2 font-medium">{formatUZS(summary.totalAmount)} UZS</span>
      </span>
      <span className="text-border">|</span>
      <span>
        <span className="text-muted-foreground">Paid</span>
        <span className="ml-2 font-medium text-green-700/80">{formatUZS(summary.paidAmount)}</span>
      </span>
      <span className="text-border">|</span>
      <span>
        <span className="text-muted-foreground">Unpaid</span>
        <span className="ml-2 font-medium text-red-700/80">{formatUZS(summary.unpaidAmount)}</span>
      </span>
      <span className="text-border">|</span>
      <span>
        <span className="text-muted-foreground">Records</span>
        <span className="ml-2 font-medium">{summary.paidCount}/{summary.recordCount} paid</span>
      </span>
    </div>
  );
}
