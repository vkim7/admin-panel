"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES_FULL } from "@/lib/constants";

interface MonthSelectorProps {
  year: number;
  month: number;
}

export function MonthSelector({ year, month }: MonthSelectorProps) {
  const router = useRouter();

  function navigate(newYear: number, newMonth: number) {
    router.push(`/teacher-payments?year=${newYear}&month=${newMonth}`);
  }

  function handlePrev() {
    if (month === 1) {
      navigate(year - 1, 12);
    } else {
      navigate(year, month - 1);
    }
  }

  function handleNext() {
    if (month === 12) {
      navigate(year + 1, 1);
    } else {
      navigate(year, month + 1);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="size-8" onClick={handlePrev}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-medium">
        {MONTH_NAMES_FULL[month]} {year}
      </span>
      <Button variant="outline" size="icon" className="size-8" onClick={handleNext}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
