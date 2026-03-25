import Link from "next/link";
import { getExams } from "@/lib/queries/exams";
import { ExamsTable } from "@/components/exams/exams-table";
import { MONTH_NAMES } from "@/lib/constants";

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  const parsedYear = params.year ? parseInt(params.year, 10) : NaN;
  const parsedMonth = params.month ? parseInt(params.month, 10) : NaN;
  const year = Number.isFinite(parsedYear) ? parsedYear : currentYear;
  const month =
    Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : currentMonth;

  const exams = await getExams(year, month);

  // Generate month pills: 1 back + 4 forward (exams are forward-looking)
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = -1; i < 5; i++) {
    const d = new Date(Date.UTC(currentYear, currentMonth - 1 + i, 1));
    months.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      label: `${MONTH_NAMES[d.getUTCMonth() + 1]} ${d.getUTCFullYear()}`,
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Exams</h1>

      <div className="flex gap-1 flex-wrap">
        {months.map((m) => {
          const isActive = m.year === year && m.month === month;
          return (
            <Link
              key={`${m.year}-${m.month}`}
              href={`/exams?year=${m.year}&month=${m.month}`}
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

      <ExamsTable data={exams} />
    </div>
  );
}
