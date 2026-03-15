import { getReceptionStudents, getGroupsForAssignment } from "@/lib/queries/reception";
import { PageHeader } from "@/components/ui/page-header";
import { ReceptionTable } from "@/components/reception/reception-table";

export default async function ReceptionPage() {
  const [students, groups] = await Promise.all([
    getReceptionStudents(),
    getGroupsForAssignment(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reception (${students.length})`}
        breadcrumbs={[{ label: "Reception" }]}
      />
      <ReceptionTable data={students} groups={groups} />
    </div>
  );
}
