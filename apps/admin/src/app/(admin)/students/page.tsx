import Link from "next/link";
import { getStudents } from "@/lib/queries/students";
import { StudentTable } from "@/components/students/student-table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function StudentsPage() {
  const students = await getStudents();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        actions={
          <Button asChild>
            <Link href="/students/new">
              <Plus className="mr-1 size-4" />
              Add Student
            </Link>
          </Button>
        }
      />
      <StudentTable data={students} />
    </div>
  );
}
