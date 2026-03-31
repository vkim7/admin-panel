import Link from "next/link";
import { getHolidaysByYear } from "@/lib/queries/holidays";
import { HolidaysTable } from "@/components/holidays/holidays-table";
import { AddHolidayDialog } from "@/components/holidays/add-holiday-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { getUzbekistanToday } from "@/lib/helpers/date";

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;

  const currentYear = getUzbekistanToday().getUTCFullYear();
  const parsedYear = params.year ? parseInt(params.year, 10) : NaN;
  const year = Number.isFinite(parsedYear) ? parsedYear : currentYear;

  const holidays = await getHolidaysByYear(year);

  // Year pills: current year + 2 next years
  const years = [currentYear, currentYear + 1, currentYear + 2];

  return (
    <div className="space-y-6">
      <PageHeader title="Holidays" actions={<AddHolidayDialog />} />

      <div className="flex gap-1">
        {years.map((y) => {
          const isActive = y === year;
          return (
            <Link
              key={y}
              href={`/holidays?year=${y}`}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {y}
            </Link>
          );
        })}
      </div>

      <HolidaysTable data={holidays} />
    </div>
  );
}
