import { TeacherForm } from "@/components/teachers/teacher-form";

export default function NewTeacherPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Add Teacher</h1>
      <TeacherForm />
    </div>
  );
}
