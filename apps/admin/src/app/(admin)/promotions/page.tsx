import Link from "next/link";
import { getPromotions } from "@/lib/queries/promotions";
import { PromotionTable } from "@/components/promotions/promotion-table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function PromotionsPage() {
  const promotions = await getPromotions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        actions={
          <Button asChild>
            <Link href="/promotions/new">
              <Plus className="mr-1 size-4" />
              Add Promotion
            </Link>
          </Button>
        }
      />
      <PromotionTable data={promotions} />
    </div>
  );
}
