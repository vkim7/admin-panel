import { getUnpaidPeriods } from "@/lib/queries/payments";
import { NoPaymentTable } from "@/components/payments/no-payment-table";
import { Badge } from "@/components/ui/badge";

export default async function PaymentsPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const unpaid = await getUnpaidPeriods(year, month);

  const totalRemaining = unpaid.reduce(
    (sum, p) => sum + (p.amountDue - p.discountAmount - p.amountPaid),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">No Payment List</h1>
          <Badge variant="destructive">{unpaid.length} unpaid</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Total remaining: <span className="font-medium text-destructive">{totalRemaining.toLocaleString("en-US")} UZS</span>
        </p>
      </div>
      <NoPaymentTable data={unpaid} currentYear={year} currentMonth={month} />
    </div>
  );
}
