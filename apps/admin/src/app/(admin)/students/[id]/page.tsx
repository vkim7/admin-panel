import { notFound } from "next/navigation";
import Link from "next/link";
import { getStudentById, getLostReasons } from "@/lib/queries/students";
import { StudentActions } from "@/components/students/student-actions";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil } from "lucide-react";

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  ELEMENTARY: "Elementary",
  PRE_INTERMEDIATE: "Pre-Intermediate",
  INTERMEDIATE: "Intermediate",
  UPPER_INTERMEDIATE: "Upper-Intermediate",
  IELTS: "IELTS",
};

const DAY_SHORT: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

const LANGUAGE_LABEL: Record<string, string> = {
  UZBEK: "Uzbek",
  RUSSIAN: "Russian",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [student, lostReasons] = await Promise.all([
    getStudentById(id),
    getLostReasons(),
  ]);

  if (!student) notFound();

  const activeMemberships = student.groupMemberships.filter(
    (m) => !m.leaveDate,
  );
  const pastMemberships = student.groupMemberships.filter(
    (m) => m.leaveDate,
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        breadcrumbs={[
          { label: "Students", href: "/students" },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/students/${id}/edit`}>
                <Pencil className="mr-1 size-4" />
                Edit
              </Link>
            </Button>
            <StudentActions
              studentId={id}
              status={student.status}
              lostReasons={lostReasons}
            />
          </>
        }
      />
      <div className="flex items-center gap-3">
        <StatusBadge type="student" value={student.status} />
        <span className="text-sm text-muted-foreground">CRM: {student.crmCode}</span>
        <span className="text-sm text-muted-foreground">{student.phone}</span>
      </div>

      {/* Profile Info */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Level</p>
          <Badge variant="secondary" className="mt-1">
            {LEVEL_LABEL[student.level] ?? student.level}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Date of Birth
          </p>
          <p className="mt-1 text-sm">
            {new Date(student.dateOfBirth).toLocaleDateString("en-GB")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Preferred Days
          </p>
          <p className="mt-1 text-sm">
            {student.preferredDays.length > 0
              ? student.preferredDays
                  .map((d) => DAY_SHORT[d])
                  .join(" / ")
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Preferred Time Slots
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {student.preferredTimeSlots.length > 0
              ? student.preferredTimeSlots.map((slot) => (
                  <span
                    key={slot}
                    className="rounded-md border bg-muted px-2 py-0.5 text-xs"
                  >
                    {slot}
                  </span>
                ))
              : <span className="text-sm">—</span>}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Preferred Language
          </p>
          <p className="mt-1 text-sm">
            {student.preferredLanguage
              ? LANGUAGE_LABEL[student.preferredLanguage]
              : "No preference"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Active Groups
          </p>
          <p className="mt-1 text-sm">{activeMemberships.length}</p>
        </div>
      </div>

      {/* Family Info */}
      {student.family && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Family</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Parent Name
                </p>
                <p className="mt-1 text-sm">
                  {student.family.parentFirstName}{" "}
                  {student.family.parentLastName}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Parent Phone
                </p>
                <p className="mt-1 text-sm">{student.family.parentPhone}</p>
              </div>
              {student.family.name && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Family Name
                  </p>
                  <p className="mt-1 text-sm">{student.family.name}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Comment */}
      {student.comment && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Notes</h3>
            <p className="text-sm text-muted-foreground">{student.comment}</p>
          </div>
        </>
      )}

      {/* Active Groups */}
      {activeMemberships.length > 0 && (
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
                    <th className="px-3 py-2 text-left font-medium">
                      Schedule
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeMemberships.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2 font-medium">
                        {m.group.publicId}
                      </td>
                      <td className="px-3 py-2">
                        {m.group.type === "INDIVIDUAL"
                          ? "Individual"
                          : "Group"}
                      </td>
                      <td className="px-3 py-2">
                        {LEVEL_LABEL[m.group.level] ?? m.group.level}
                      </td>
                      <td className="px-3 py-2">
                        {m.group.days
                          .map((d: number) => DAY_SHORT[d])
                          .join("/")}{" "}
                        {m.group.startTime}
                      </td>
                      <td className="px-3 py-2">
                        {new Date(m.joinDate).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Past Groups */}
      {pastMemberships.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Group History</h3>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Group</th>
                    <th className="px-3 py-2 text-left font-medium">Level</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Joined
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {pastMemberships.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2 font-medium">
                        {m.group.publicId}
                      </td>
                      <td className="px-3 py-2">
                        {LEVEL_LABEL[m.group.level] ?? m.group.level}
                      </td>
                      <td className="px-3 py-2">
                        {new Date(m.joinDate).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-3 py-2">
                        {m.leaveDate
                          ? new Date(m.leaveDate).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Lifecycle info */}
      {student.activatedAt && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Activated: </span>
              {new Date(student.activatedAt).toLocaleDateString("en-GB")}
              {student.activatedBy && (
                <>
                  {" "}
                  by {student.activatedBy.firstName}{" "}
                  {student.activatedBy.lastName}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Deactivation info */}
      {student.status === "INACTIVE" && student.inactivatedAt && (
        <>
          <Separator />
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm">
              <span className="font-medium">Deactivated</span> on{" "}
              {new Date(student.inactivatedAt).toLocaleDateString("en-GB")}
              {student.inactivatedBy && (
                <>
                  {" "}
                  by {student.inactivatedBy.firstName}{" "}
                  {student.inactivatedBy.lastName}
                </>
              )}
            </p>
            {student.lostReason && (
              <p className="mt-1 text-sm text-muted-foreground">
                Reason: {student.lostReason.name}
                {student.otherLostReason && ` — ${student.otherLostReason}`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
