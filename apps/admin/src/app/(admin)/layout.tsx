import { AppSidebar } from "@/components/app-sidebar";
import { requireAdmin } from "@/lib/auth";
import { getReceptionCount } from "@/lib/queries/reception";
import { getReassignmentCount } from "@/lib/queries/reassignment";
import { getUncertainCount } from "@/lib/queries/students";
import { getPendingResolutionCount } from "@/lib/queries/lessons";
import { getPendingRefundCount } from "@/lib/queries/refunds";
import { getLostCount } from "@/lib/queries/lost";
import { getScheduledActionCount } from "@/lib/queries/scheduled-actions";
import { getNewLeadCount } from "@/lib/queries/leads";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // This will redirect to /login if not authenticated
  const [admin, receptionCount, reassignmentCount, uncertainCount, pendingResolutionCount, pendingRefundCount, lostCount, scheduledCount, leadCount] = await Promise.all([
    requireAdmin(),
    getReceptionCount(),
    getReassignmentCount(),
    getUncertainCount(),
    getPendingResolutionCount(),
    getPendingRefundCount(),
    getLostCount(),
    getScheduledActionCount(),
    getNewLeadCount(),
  ]);

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        adminName={`${admin.firstName} ${admin.lastName}`}
        receptionCount={receptionCount}
        reassignmentCount={reassignmentCount}
        uncertainCount={uncertainCount}
        pendingResolutionCount={pendingResolutionCount}
        pendingRefundCount={pendingRefundCount}
        lostCount={lostCount}
        scheduledCount={scheduledCount}
        leadCount={leadCount}
      />
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
