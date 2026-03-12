import { notFound } from "next/navigation";
import { getTeacherById } from "@/lib/queries/teachers";
import { TeacherForm } from "@/components/teachers/teacher-form";

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
      <h1 className="text-2xl font-semibold">
        Edit {teacher.firstName} {teacher.lastName}
      </h1>
      <TeacherForm
        teacherId={id}
        defaultValues={{
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          phone: teacher.phone,
          levels: teacher.levels as any,
          canTeachUzbek: teacher.canTeachUzbek,
          canTeachRussian: teacher.canTeachRussian,
          canTeachEnglishOnly: teacher.canTeachEnglishOnly,
        }}
      />
    </div>
  );
}
