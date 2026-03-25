import { getAllRefunds, getPendingRefundCount } from "@/lib/queries/refunds";
import { RefundTable } from "@/components/refunds/refund-table";
import { Badge } from "@/components/ui/badge";

export default async function RefundsPage() {
  const [refunds, pendingCount] = await Promise.all([
    getAllRefunds(),
    getPendingRefundCount(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Refunds</h1>
        {pendingCount > 0 && (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {refunds.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No refunds recorded yet.
        </div>
      ) : (
        <RefundTable data={refunds} />
      )}
    </div>
  );
}
