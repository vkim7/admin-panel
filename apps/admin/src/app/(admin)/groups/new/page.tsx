import { GroupForm } from "@/components/groups/group-form";
import { PageHeader } from "@/components/ui/page-header";
import { getTeachersForGroupForm } from "@/lib/queries/groups";

export default async function NewGroupPage() {
  const teachers = await getTeachersForGroupForm();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Create Group"
        breadcrumbs={[
          { label: "Groups", href: "/groups" },
          { label: "Create Group" },
        ]}
      />
      <GroupForm teachers={teachers} />
    </div>
  );
}
