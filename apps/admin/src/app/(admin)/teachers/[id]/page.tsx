import { notFound } from "next/navigation";
import Link from "next/link";
import { getTeacherById, getTeacherTrialHistory, getTeacherDocuments, getCurrentPriceLimits } from "@/lib/queries/teachers";
import { getTeacherUnavailability } from "@/lib/queries/lessons";
import { getTeacherPaymentHistory } from "@/lib/queries/teacher-payments";
import { AvailabilityEditor } from "@/components/teachers/availability-editor";
import { RateHistory } from "@/components/teachers/rate-history";
import { TrialHistory } from "@/components/teachers/trial-history";
import { UnavailabilitySection } from "@/components/teachers/unavailability-section";
import { TeacherDocumentsSection } from "@/components/teachers/teacher-documents-section";
import { PaymentHistoryTable } from "@/components/teachers/payment-history-table";
import { TeacherActions } from "@/components/teachers/teacher-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil } from "lucide-react";

const DAY_SHORT: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  ELEMENTARY: "Elementary",
  PRE_INTERMEDIATE: "Pre-Intermediate",
  INTERMEDIATE: "Intermediate",
  UPPER_INTERMEDIATE: "Upper-Intermediate",
  IELTS: "IELTS",
};

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [teacher, unavailabilities, paymentHistory, trialHistory, documents, priceLimits] = await Promise.all([
    getTeacherById(id),
    getTeacherUnavailability(id),
    getTeacherPaymentHistory(id),
    getTeacherTrialHistory(id),
    getTeacherDocuments(id),
    getCurrentPriceLimits(),
  ]);
  if (!teacher) notFound();

  const LANG_LABEL: Record<string, string> = { UZBEK: "Uzbek", RUSSIAN: "Russian", ANY: "Both" };
  const languages = [LANG_LABEL[teacher.teachingLanguage] ?? "Both"];

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title={`${teacher.firstName} ${teacher.lastName}`}
        breadcrumbs={[
          { label: "Teachers", href: "/teachers" },
          { label: `${teacher.firstName} ${teacher.lastName}` },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/teachers/${id}/edit`}>
                <Pencil className="mr-1 size-4" />
                Edit
              </Link>
            </Button>
            {teacher.isActive && <TeacherActions teacherId={id} />}
          </>
        }
      />
      {!teacher.isActive && (
        <Badge variant="destructive">Inactive</Badge>
      )}
      <p className="text-sm text-muted-foreground">{teacher.phone}</p>

      {/* Profile Info */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">PINFL</p>
          <p className="mt-1 text-sm font-mono">{teacher.pinfl}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Levels</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {teacher.levels.map((l) => (
              <Badge key={l} variant="secondary">
                {LEVEL_LABEL[l] ?? l}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Languages</p>
          <p className="mt-1 text-sm">{languages.join(", ")}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Active Groups</p>
          <p className="mt-1 text-sm">{teacher.groups.length}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Zoom Email</p>
          <p className="mt-1 text-sm">
            {teacher.zoomEmail ?? <span className="text-destructive font-medium">Not configured</span>}
          </p>
        </div>
      </div>

      {/* Active Groups */}
      {teacher.groups.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Active Groups</h3>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Group</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Level</th>
                    <th className="px-3 py-2 text-left font-medium">Schedule</th>
                    <th className="px-3 py-2 text-left font-medium">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {teacher.groups.map((g) => (
                    <tr key={g.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{g.publicId}</td>
                      <td className="px-3 py-2">{g.type === "INDIVIDUAL" ? "Individual" : "Group"}</td>
                      <td className="px-3 py-2">{LEVEL_LABEL[g.level] ?? g.level}</td>
                      <td className="px-3 py-2">
                        {g.days.map((d: number) => DAY_SHORT[d]).join("/")} {g.startTime}
                      </td>
                      <td className="px-3 py-2">{g.memberships.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {trialHistory.length > 0 && (
        <>
          <Separator />
          <TrialHistory trials={trialHistory} />
        </>
      )}

      <Separator />

      {/* Availability */}
      <AvailabilityEditor teacherId={id} blocks={teacher.availability} />

      <Separator />

      {/* Unavailability */}
      <UnavailabilitySection teacherId={id} unavailabilities={unavailabilities} />

      <Separator />

      {/* Rate History */}
      <RateHistory teacherId={id} rates={teacher.rateChanges} priceLimits={priceLimits} />

      <Separator />

      {/* Documents */}
      <TeacherDocumentsSection teacherId={id} documents={documents} />

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Payment History</h3>
            <PaymentHistoryTable payments={paymentHistory} />
          </div>
        </>
      )}

      {/* Deactivation info */}
      {!teacher.isActive && teacher.deactivatedAt && (
        <>
          <Separator />
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm">
              <span className="font-medium">Deactivated</span>{" "}
              on {new Date(teacher.deactivatedAt).toLocaleDateString("en-GB")}
              {teacher.deactivatedBy && (
                <> by {teacher.deactivatedBy.firstName} {teacher.deactivatedBy.lastName}</>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
