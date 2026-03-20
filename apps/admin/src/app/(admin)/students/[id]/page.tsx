import { notFound } from "next/navigation";
import Link from "next/link";
import { getStudentById, getLostReasons, getTrialMembershipAttendance } from "@/lib/queries/students";
import { getStudentPaymentPeriods } from "@/lib/queries/payments";
import { getStudentPromotions, getActivePromotions } from "@/lib/queries/promotions";
import { getStudentReferrals } from "@/lib/queries/referrals";
import { StudentActions } from "@/components/students/student-actions";
import { PaymentHistory } from "@/components/payments/payment-history";
import { AssignPromotionDialog } from "@/components/promotions/assign-dialog";
import { TrialStatusBadge, getTrialStatus } from "@/components/ui/trial-status-badge";
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
  ANY: "Any",
};

const STAGE_LABEL: Record<string, string> = {
  BEGINNING: "Beginning",
  MID: "Mid",
  FINAL: "Final",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [student, lostReasons, paymentPeriods, studentPromotions, activePromotions, referrals] = await Promise.all([
    getStudentById(id),
    getLostReasons(),
    getStudentPaymentPeriods(id),
    getStudentPromotions(id),
    getActivePromotions(),
    getStudentReferrals(id),
  ]);

  if (!student) notFound();

  const activeMemberships = student.groupMemberships.filter(
    (m) => !m.leaveDate,
  );
  const pastMemberships = student.groupMemberships.filter(
    (m) => m.leaveDate,
  );

  // Fetch trial attendance scoped to each membership's date window
  const trialPastMemberships = pastMemberships
    .filter((m) => m.wasTrialOriginally)
    .map((m) => ({
      id: m.id,
      studentId: id,
      groupId: m.group.id,
      joinDate: m.joinDate,
      leaveDate: m.leaveDate,
    }));
  const trialMembershipIdsWithAttendance = await getTrialMembershipAttendance(
    trialPastMemberships,
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
            {LEVEL_LABEL[student.level] ?? student.level} · {STAGE_LABEL[student.progressStage] ?? student.progressStage}
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
            {LANGUAGE_LABEL[student.preferredLanguage] ?? student.preferredLanguage}
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
                        <Link
                          href={`/groups/${m.group.id}`}
                          className="text-primary hover:underline"
                        >
                          {m.group.publicId}
                        </Link>
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
                    <th className="px-3 py-2 text-left font-medium">Reason</th>
                    <th className="px-3 py-2 text-left font-medium">Moved to</th>
                  </tr>
                </thead>
                <tbody>
                  {pastMemberships.map((m) => {
                    // Derive why the membership ended
                    const continuedTo = m.continuedAsMemberships[0]?.group;
                    let reason: string | null = null;
                    let reasonTarget: { id: string; publicId: string } | null = null;

                    if (m.wasTrialOriginally) {
                      // Trial status handled by badge below
                      reason = null;
                    } else if (m.transferReason) {
                      reason = m.transferReason.isOther && m.otherTransferReason
                        ? m.otherTransferReason
                        : m.transferReason.name;
                    } else if (m.group.mergedIntoGroupId) {
                      reason = "Merged";
                      reasonTarget = m.group.mergedIntoGroup;
                    } else if (m.group.graduatedIntoGroupId) {
                      reason = "Graduated";
                      reasonTarget = m.group.graduatedIntoGroup;
                    }

                    return (
                      <tr key={m.id} className="border-t">
                        <td className="px-3 py-2 font-medium">
                          <Link
                            href={`/groups/${m.group.id}`}
                            className="text-primary hover:underline"
                          >
                            {m.group.publicId}
                          </Link>
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
                        <td className="px-3 py-2">
                          {m.wasTrialOriginally ? (
                            <TrialStatusBadge
                              status={getTrialStatus(
                                m.isTrial,
                                trialMembershipIdsWithAttendance.has(m.id),
                              )}
                            />
                          ) : (
                            <span className="text-muted-foreground">{reason ?? "—"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {(continuedTo ?? reasonTarget) ? (
                            <Link
                              href={`/groups/${(continuedTo ?? reasonTarget)!.id}`}
                              className="text-primary hover:underline"
                            >
                              {(continuedTo ?? reasonTarget)!.publicId}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Payments */}
      {paymentPeriods.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Payments</h3>
            <PaymentHistory
              periods={paymentPeriods}
              studentName={`${student.firstName} ${student.lastName}`}
            />
          </div>
        </>
      )}

      {/* Promotions */}
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Promotions</h3>
          <AssignPromotionDialog studentId={id} promotions={activePromotions} />
        </div>
        {studentPromotions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No promotions assigned.</p>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Promotion</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Discount</th>
                  <th className="px-3 py-2 text-left font-medium">Applied</th>
                  <th className="px-3 py-2 text-left font-medium">Expires</th>
                  <th className="px-3 py-2 text-left font-medium">Used</th>
                </tr>
              </thead>
              <tbody>
                {studentPromotions.map((sp) => (
                  <tr key={sp.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{sp.promotion.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="text-xs">
                        {sp.promotion.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {sp.promotion.discountType === "PERCENTAGE"
                        ? `${sp.promotion.discountPercent}%`
                        : `${(sp.promotion.discountAmount ?? 0).toLocaleString()} UZS`}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(sp.appliedAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {sp.expiresAt
                        ? new Date(sp.expiresAt).toLocaleDateString("en-GB")
                        : "Never"}
                    </td>
                    <td className="px-3 py-2">
                      {sp._count.appliedPromotions} period{sp._count.appliedPromotions !== 1 ? "s" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Referrals */}
      <Separator />
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Referrals</h3>
        {student.referralCode && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Referral Code:</span>
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
              {student.referralCode}
            </code>
          </div>
        )}
        {referrals.referralReceived && (
          <div className="text-sm">
            <span className="text-muted-foreground">Referred by: </span>
            <Link
              href={`/students/${referrals.referralReceived.referrer.id}`}
              className="text-primary hover:underline"
            >
              {referrals.referralReceived.referrer.firstName}{" "}
              {referrals.referralReceived.referrer.lastName}
            </Link>
            <span className="ml-2">
              <StatusBadge type="refund" value={referrals.referralReceived.status} />
            </span>
          </div>
        )}
        {referrals.referralsMade.length > 0 ? (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Referred Student</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Completed</th>
                </tr>
              </thead>
              <tbody>
                {referrals.referralsMade.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/students/${r.referred.id}`}
                        className="text-primary hover:underline"
                      >
                        {r.referred.firstName} {r.referred.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge type="refund" value={r.status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.completedAt
                        ? new Date(r.completedAt).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No referrals made.</p>
        )}
      </div>

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
