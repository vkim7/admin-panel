import { getUncertainStudents } from "@/lib/queries/students";
import { UncertainTable } from "@/components/uncertain/uncertain-table";
import { PageHeader } from "@/components/ui/page-header";

export default async function UncertainPage() {
  const students = await getUncertainStudents();

  return (
    <div className="space-y-6">
      <PageHeader title={`Uncertain (${students.length})`} />
      <UncertainTable data={students} />
    </div>
  );
}
