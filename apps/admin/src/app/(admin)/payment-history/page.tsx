import Link from "next/link";
import { getPaidPayments } from "@/lib/queries/payments";
import { PaidPaymentsTable } from "@/components/payments/paid-payments-table";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const PAYMENT_METHODS = [
  { value: "", label: "All Methods" },
  { value: "click", label: "Click" },
  { value: "payme", label: "Payme" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

export default async function PaymentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; method?: string }>;
}) {
  const params = await searchParams;

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  const parsedYear = params.year ? parseInt(params.year, 10) : NaN;
  const parsedMonth = params.month ? parseInt(params.month, 10) : NaN;
  const year = Number.isFinite(parsedYear) ? parsedYear : currentYear;
  const month = Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : currentMonth;
  const method = params.method ?? "";

  const payments = await getPaidPayments(year, month, method || undefined);

  // Generate last 6 months for the picker
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(currentYear, currentMonth - 1 - i, 1));
    months.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      label: `${MONTH_NAMES[d.getUTCMonth() + 1]} ${d.getUTCFullYear()}`,
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Payment History</h1>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {months.map((m) => {
            const isActive = m.year === year && m.month === month;
            return (
              <Link
                key={`${m.year}-${m.month}`}
                href={`/payment-history?year=${m.year}&month=${m.month}${method ? `&method=${method}` : ""}`}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex gap-1">
          {PAYMENT_METHODS.map((pm) => {
            const isActive = pm.value === method;
            return (
              <Link
                key={pm.value}
                href={`/payment-history?year=${year}&month=${month}${pm.value ? `&method=${pm.value}` : ""}`}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {pm.label}
              </Link>
            );
          })}
        </div>
      </div>

      <PaidPaymentsTable data={payments} currentYear={year} currentMonth={month} />
    </div>
  );
}
