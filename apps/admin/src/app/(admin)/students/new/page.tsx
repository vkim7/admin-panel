import { StudentForm } from "@/components/students/student-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = params.returnTo === "/reception" ? "/reception" : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add Student"
        breadcrumbs={[
          { label: returnTo ? "Reception" : "Students", href: returnTo ?? "/students" },
          { label: "Add Student" },
        ]}
      />
      <StudentForm redirectTo={returnTo} />
    </div>
  );
}
