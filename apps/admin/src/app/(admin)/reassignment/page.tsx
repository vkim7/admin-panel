import { getReassignmentStudents, getOrphanedStudents } from "@/lib/queries/reassignment";
import { getGroupsForAssignment } from "@/lib/queries/reception";
import { getLostReasons } from "@/lib/queries/students";
import { PageHeader } from "@/components/ui/page-header";
import { ReassignmentTable } from "@/components/reassignment/reassignment-table";
import { OrphanWarning } from "@/components/reassignment/orphan-warning";

export default async function ReassignmentPage() {
  const [students, groups, orphans, lostReasons] = await Promise.all([
    getReassignmentStudents(),
    getGroupsForAssignment(),
    getOrphanedStudents(),
    getLostReasons(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reassignment (${students.length})`}
        breadcrumbs={[{ label: "Reassignment" }]}
      />
      <OrphanWarning orphans={orphans} lostReasons={lostReasons} />
      <ReassignmentTable data={students} groups={groups} lostReasons={lostReasons} />
    </div>
  );
}
