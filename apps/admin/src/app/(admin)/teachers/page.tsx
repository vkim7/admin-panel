import Link from "next/link";
import { getAllTeachers } from "@/lib/queries/teachers";
import { TeacherTable } from "@/components/teachers/teacher-table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function TeachersPage() {
  const teachers = await getAllTeachers(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers"
        actions={
          <Button asChild>
            <Link href="/teachers/new">
              <Plus className="mr-1 size-4" />
              Add Teacher
            </Link>
          </Button>
        }
      />
      <TeacherTable data={teachers} />
    </div>
  );
}
