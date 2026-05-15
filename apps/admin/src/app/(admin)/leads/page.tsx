import { getLeads } from "@/lib/queries/leads";
import { PageHeader } from "@/components/ui/page-header";
import { LeadsTabs } from "@/components/leads/leads-tabs";

export default async function LeadsPage() {
  // Default tab is Active — we fetch only NEW + CONTACTED on initial load.
  // Other tabs lazy-load via fetchLeadsByTabAction when admin switches.
  const initialActiveLeads = await getLeads({
    statuses: ["NEW", "CONTACTED"],
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" breadcrumbs={[{ label: "Leads" }]} />
      <LeadsTabs initialActiveLeads={initialActiveLeads} />
    </div>
  );
}
