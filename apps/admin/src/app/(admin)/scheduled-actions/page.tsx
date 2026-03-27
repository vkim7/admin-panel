import { getScheduledActions, getScheduledActionCount } from "@/lib/queries/scheduled-actions";
import { ScheduledActionsTable } from "@/components/scheduled-actions/scheduled-actions-table";
import { Badge } from "@/components/ui/badge";

export default async function ScheduledActionsPage() {
  const [actions, pendingCount] = await Promise.all([
    getScheduledActions(),
    getScheduledActionCount(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Scheduled Actions</h1>
        {pendingCount > 0 && (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {actions.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No scheduled actions yet.
        </div>
      ) : (
        <ScheduledActionsTable data={actions} />
      )}
    </div>
  );
}
