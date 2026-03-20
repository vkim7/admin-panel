import { notFound } from "next/navigation";
import { getPromotionById } from "@/lib/queries/promotions";
import { PromotionForm } from "@/components/promotions/promotion-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const promotion = await getPromotionById(id);
  if (!promotion) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Edit ${promotion.name}`}
        breadcrumbs={[
          { label: "Promotions", href: "/promotions" },
          { label: promotion.name },
          { label: "Edit" },
        ]}
      />
      <PromotionForm
        promotionId={id}
        defaultValues={{
          name: promotion.name,
          type: promotion.type,
          discountType: promotion.discountType,
          discountPercent: promotion.discountPercent,
          discountAmount: promotion.discountAmount,
          levels: promotion.levels as any,
          groupTypes: promotion.groupTypes as any,
          isRecurring: promotion.isRecurring,
          recurringMonths: promotion.recurringMonths,
          maxUsesPerStudent: promotion.maxUsesPerStudent,
          maxUsesTotal: promotion.maxUsesTotal,
          validityDays: promotion.validityDays,
          validFrom: promotion.validFrom
            ? promotion.validFrom.toISOString().slice(0, 10)
            : null,
          validTo: promotion.validTo
            ? promotion.validTo.toISOString().slice(0, 10)
            : null,
          code: promotion.code,
          isActive: promotion.isActive,
        }}
      />
    </div>
  );
}
