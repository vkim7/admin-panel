import { getTeacherPaymentPeriods, getTeacherPaySummary } from "@/lib/queries/teacher-payments";
import { TeacherPayTable } from "@/components/teacher-payments/teacher-pay-table";
import { PaySummaryCards } from "@/components/teacher-payments/pay-summary-cards";
import { MonthSelector } from "@/components/teacher-payments/month-selector";
import { GeneratePayDialog } from "@/components/teacher-payments/generate-pay-dialog";

function getPreviousMonth() {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0-indexed, so this is already "previous month"
  if (month === 0) {
    year -= 1;
    month = 12;
  }
  return { year, month };
}

export default async function TeacherPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const defaults = getPreviousMonth();
  const year = params.year ? Number(params.year) : defaults.year;
  const month = params.month ? Number(params.month) : defaults.month;

  const [data, summary] = await Promise.all([
    getTeacherPaymentPeriods(year, month),
    getTeacherPaySummary(year, month),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Teacher Payments</h1>
        <div className="flex items-center gap-3">
          <MonthSelector year={year} month={month} />
          <GeneratePayDialog year={year} month={month} />
        </div>
      </div>

      {summary.recordCount > 0 ? (
        <>
          <PaySummaryCards summary={summary} />
          <TeacherPayTable data={data} year={year} month={month} />
        </>
      ) : (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No payment records for this month. Use &quot;Generate Pay&quot; to create them.
        </div>
      )}
    </div>
  );
}
