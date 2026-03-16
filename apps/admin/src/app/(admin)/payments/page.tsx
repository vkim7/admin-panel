import { getUnpaidPeriods } from "@/lib/queries/payments";
import { NoPaymentTable } from "@/components/payments/no-payment-table";
import { Badge } from "@/components/ui/badge";

export default async function PaymentsPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const unpaid = await getUnpaidPeriods(year, month);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">No Payment List</h1>
        <Badge variant="destructive">{unpaid.length} unpaid</Badge>
      </div>
      <NoPaymentTable data={unpaid} currentYear={year} currentMonth={month} />
    </div>
  );
}
