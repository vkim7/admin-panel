import { PromotionForm } from "@/components/promotions/promotion-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewPromotionPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add Promotion"
        breadcrumbs={[
          { label: "Promotions", href: "/promotions" },
          { label: "Add Promotion" },
        ]}
      />
      <PromotionForm />
    </div>
  );
}
