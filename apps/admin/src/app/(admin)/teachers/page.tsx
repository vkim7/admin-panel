import Link from "next/link";
import { getTeachers } from "@/lib/queries/teachers";
import { TeacherTable } from "@/components/teachers/teacher-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function TeachersPage() {
  const teachers = await getTeachers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Teachers</h1>
        <Button asChild>
          <Link href="/teachers/new">
            <Plus className="mr-1 size-4" />
            Add Teacher
          </Link>
        </Button>
      </div>
      <TeacherTable data={teachers} />
    </div>
  );
}
