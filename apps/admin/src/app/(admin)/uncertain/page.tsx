import { getUncertainStudents, getLostReasons } from "@/lib/queries/students";
import { getTransferReasons, getGroupsForTransfer } from "@/lib/queries/transfers";
import { UncertainTable } from "@/components/uncertain/uncertain-table";
import { PageHeader } from "@/components/ui/page-header";

export default async function UncertainPage() {
  const [students, lostReasons, transferReasons, availableGroups] =
    await Promise.all([
      getUncertainStudents(),
      getLostReasons(),
      getTransferReasons(),
      getGroupsForTransfer(),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Uncertain (${students.length})`} />
      <UncertainTable
        data={students}
        transferReasons={transferReasons}
        availableGroups={availableGroups}
        lostReasons={lostReasons}
      />
    </div>
  );
}
