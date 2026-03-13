import { TeacherForm } from "@/components/teachers/teacher-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewTeacherPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add Teacher"
        breadcrumbs={[
          { label: "Teachers", href: "/teachers" },
          { label: "Add Teacher" },
        ]}
      />
      <TeacherForm />
    </div>
  );
}
