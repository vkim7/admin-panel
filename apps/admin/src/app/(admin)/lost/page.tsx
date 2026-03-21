import { getLostStudents } from "@/lib/queries/lost";
import { getGroupsForAssignment } from "@/lib/queries/reception";
import { PageHeader } from "@/components/ui/page-header";
import { LostTable } from "@/components/lost/lost-table";

export default async function LostPage() {
  const [students, groups] = await Promise.all([
    getLostStudents(),
    getGroupsForAssignment(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Lost (${students.length})`}
        breadcrumbs={[{ label: "Lost" }]}
      />
      <LostTable data={students} groups={groups} />
    </div>
  );
}
