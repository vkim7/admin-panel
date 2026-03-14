import { GroupForm } from "@/components/groups/group-form";
import { PageHeader } from "@/components/ui/page-header";
import { getTeachersForGroupForm } from "@/lib/queries/groups";

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string; days?: string; startTime?: string }>;
}) {
  const teachers = await getTeachersForGroupForm();
  const params = await searchParams;

  // Pre-fill from schedule page query params
  const prefill = {
    teacherId: params.teacherId,
    days: params.days?.split(",").map(Number).filter((n) => !isNaN(n)),
    startTime: params.startTime,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Create Group"
        breadcrumbs={[
          { label: "Groups", href: "/groups" },
          { label: "Create Group" },
        ]}
      />
      <GroupForm teachers={teachers} prefill={prefill} />
    </div>
  );
}
