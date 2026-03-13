import { StudentForm } from "@/components/students/student-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewStudentPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add Student"
        breadcrumbs={[
          { label: "Students", href: "/students" },
          { label: "Add Student" },
        ]}
      />
      <StudentForm />
    </div>
  );
}
