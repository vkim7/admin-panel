import { notFound } from "next/navigation";
import Link from "next/link";
import { StudentForm } from "@/components/students/student-form";
import { PageHeader } from "@/components/ui/page-header";
import { getLeadForPrefill } from "@/lib/queries/leads";
import { mapLeadToStudentDefaults } from "@/lib/helpers/lead-to-student";
import type { StudentFormValues } from "@/schemas/student";

const STATIC_DEFAULTS: StudentFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  dateOfBirth: "",
  level: "BEGINNER",
  progressStage: "BEGINNING",
  preferredDays: [],
  preferredTimeSlots: [],
  preferredLanguage: "" as unknown as "UZBEK" | "RUSSIAN" | "ANY",
  preferredLessonType: "" as unknown as "GROUP" | "INDIVIDUAL" | "EITHER",
  familyId: null,
  comment: null,
  promoCode: null,
  referredByCode: null,
};

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; leadId?: string }>;
}) {
  const params = await searchParams;
  const returnTo = params.returnTo === "/reception" ? "/reception" : undefined;
  const leadId = params.leadId;

  if (!leadId) {
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

  const lead = await getLeadForPrefill(leadId);
  if (!lead) notFound();

  if (lead.status === "CONVERTED") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Lead already converted"
          breadcrumbs={[
            { label: "Leads", href: "/leads" },
            { label: "Convert" },
          ]}
        />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This lead was already converted
          {lead.student ? (
            <>
              {" "}to{" "}
              <Link
                href={`/students/${lead.student.id}`}
                className="font-medium underline"
              >
                student #{lead.student.crmCode}
              </Link>
              .
            </>
          ) : (
            "."
          )}
        </div>
      </div>
    );
  }

  const defaultValues: StudentFormValues = {
    ...STATIC_DEFAULTS,
    ...mapLeadToStudentDefaults(lead),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Convert: ${lead.firstName} ${lead.lastName}`}
        breadcrumbs={[
          { label: "Leads", href: "/leads" },
          { label: "Convert" },
        ]}
      />
      <StudentForm
        defaultValues={defaultValues}
        redirectTo={returnTo ?? "/reception"}
        cancelTo="/leads"
        leadId={lead.id}
      />
    </div>
  );
}
