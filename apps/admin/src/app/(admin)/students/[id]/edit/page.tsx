import { notFound } from "next/navigation";
import { getStudentById } from "@/lib/queries/students";
import { StudentForm } from "@/components/students/student-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await getStudentById(id);
  if (!student) notFound();

  const dateOfBirth = new Date(student.dateOfBirth)
    .toISOString()
    .split("T")[0]!;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Edit ${student.firstName} ${student.lastName}`}
        breadcrumbs={[
          { label: "Students", href: "/students" },
          { label: `${student.firstName} ${student.lastName}`, href: `/students/${id}` },
          { label: "Edit" },
        ]}
      />
      <StudentForm
        studentId={id}
        defaultValues={{
          firstName: student.firstName,
          lastName: student.lastName,
          phone: student.phone,
          dateOfBirth,
          level: student.level,
          progressStage: student.progressStage,
          preferredDays: student.preferredDays,
          preferredTimeSlots: student.preferredTimeSlots,
          preferredLanguage: student.preferredLanguage,
          preferredLessonType: student.preferredLessonType,
          familyId: student.familyId,
          comment: student.comment,
          promoCode: null,
          referredByCode: null,
        }}
        initialFamily={
          student.family
            ? {
                id: student.family.id,
                parentFirstName: student.family.parentFirstName,
                parentLastName: student.family.parentLastName,
                parentPhone: student.family.parentPhone,
              }
            : null
        }
      />
    </div>
  );
}
