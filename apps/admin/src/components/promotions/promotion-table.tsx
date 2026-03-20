"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { togglePromotionActive } from "@/lib/actions/promotions";

type PromotionRow = {
  id: string;
  name: string;
  type: string;
  discountType: string;
  discountPercent: number | null;
  discountAmount: number | null;
  levels: string[];
  groupTypes: string[];
  isRecurring: boolean;
  recurringMonths: number | null;
  code: string | null;
  isActive: boolean;
  _count: { studentPromotions: number };
};

const TYPE_LABEL: Record<string, string> = {
  SEASONAL: "Seasonal",
  FAMILY: "Family",
  LOYALTY: "Loyalty",
  WIN_BACK: "Win-Back",
  TRIAL: "Trial",
  EARLY_PAYMENT: "Early Payment",
  PARTNER: "Partner",
  OTHER: "Other",
};

const LEVEL_SHORT: Record<string, string> = {
  BEGINNER: "Beg",
  ELEMENTARY: "Elem",
  PRE_INTERMEDIATE: "Pre-Int",
  INTERMEDIATE: "Int",
  UPPER_INTERMEDIATE: "Upper-Int",
  IELTS: "IELTS",
};

function ActiveToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await togglePromotionActive(id);
          if (result?.error) toast.error(result.error);
        });
      }}
      className={isActive ? "text-green-600" : "text-muted-foreground"}
    >
      {isPending ? "..." : isActive ? "Active" : "Inactive"}
    </Button>
  );
}

const columns: ColumnDef<PromotionRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => (
      <Link
        href={`/promotions/${row.original.id}/edit`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="secondary">{TYPE_LABEL[row.original.type] ?? row.original.type}</Badge>
    ),
    enableSorting: false,
  },
  {
    id: "discount",
    header: "Discount",
    cell: ({ row }) => {
      if (row.original.discountType === "PERCENTAGE") {
        return <span className="text-sm">{row.original.discountPercent}%</span>;
      }
      return (
        <span className="text-sm">
          {(row.original.discountAmount ?? 0).toLocaleString()} UZS
        </span>
      );
    },
    enableSorting: false,
  },
  {
    id: "scope",
    header: "Scope",
    cell: ({ row }) => {
      const levels = row.original.levels;
      const types = row.original.groupTypes;
      return (
        <div className="flex flex-wrap gap-1">
          {levels.length === 0 ? (
            <Badge variant="outline" className="text-xs">All levels</Badge>
          ) : (
            levels.map((l) => (
              <Badge key={l} variant="outline" className="text-xs">
                {LEVEL_SHORT[l] ?? l}
              </Badge>
            ))
          )}
          {types.length > 0 &&
            types.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">
                {t === "GROUP" ? "Group" : "Ind"}
              </Badge>
            ))}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: "recurring",
    header: "Recurring",
    cell: ({ row }) => {
      if (!row.original.isRecurring) return <span className="text-sm text-muted-foreground">No</span>;
      return (
        <span className="text-sm">
          {row.original.recurringMonths ? `${row.original.recurringMonths} mo` : "Indefinite"}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    id: "usage",
    header: "Used",
    cell: ({ row }) => (
      <span className="text-sm">{row.original._count.studentPromotions}</span>
    ),
    enableSorting: false,
  },
  {
    id: "code",
    header: "Code",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.code ?? "—"}</span>
    ),
    enableSorting: false,
  },
  {
    id: "active",
    header: "Active",
    cell: ({ row }) => <ActiveToggle id={row.original.id} isActive={row.original.isActive} />,
    enableSorting: false,
  },
];

export function PromotionTable({ data }: { data: PromotionRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search promotions..."
    />
  );
}
