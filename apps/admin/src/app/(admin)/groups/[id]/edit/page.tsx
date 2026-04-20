import { notFound } from "next/navigation";
import { getGroupById, getTeachersForGroupForm } from "@/lib/queries/groups";
import { GroupForm } from "@/components/groups/group-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, teachers] = await Promise.all([
    getGroupById(id),
    getTeachersForGroupForm(),
  ]);
  if (!group) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Edit ${group.publicId}`}
        breadcrumbs={[
          { label: "Groups", href: "/groups" },
          { label: group.publicId, href: `/groups/${id}` },
          { label: "Edit" },
        ]}
      />
      <GroupForm
        groupId={id}
        teachers={teachers}
        defaultValues={{
          type: group.type,
          teacherId: group.teacherId,
          days: group.days,
          startTime: group.startTime,
          level: group.level as any,
          startDate: group.startDate.toISOString().split("T")[0]!,
        }}
      />
    </div>
  );
}
