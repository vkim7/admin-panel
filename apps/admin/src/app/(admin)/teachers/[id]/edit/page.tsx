import { notFound } from "next/navigation";
import { getTeacherById } from "@/lib/queries/teachers";
import { TeacherForm } from "@/components/teachers/teacher-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function EditTeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await getTeacherById(id);
  if (!teacher) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Edit ${teacher.firstName} ${teacher.lastName}`}
        breadcrumbs={[
          { label: "Teachers", href: "/teachers" },
          { label: `${teacher.firstName} ${teacher.lastName}`, href: `/teachers/${id}` },
          { label: "Edit" },
        ]}
      />
      <TeacherForm
        teacherId={id}
        defaultValues={{
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          phone: teacher.phone,
          zoomEmail: teacher.zoomEmail,
          levels: teacher.levels as any,
          teachingLanguage: teacher.teachingLanguage,
        }}
      />
    </div>
  );
}
