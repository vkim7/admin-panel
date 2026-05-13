import { getLeads } from "@/lib/queries/leads";
import { PageHeader } from "@/components/ui/page-header";
import { LeadsTabs } from "@/components/leads/leads-tabs";

export default async function LeadsPage() {
  const leads = await getLeads();

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" breadcrumbs={[{ label: "Leads" }]} />
      <LeadsTabs leads={leads} />
    </div>
  );
}
