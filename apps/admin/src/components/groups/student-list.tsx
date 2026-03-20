"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrialStatusBadge, getTrialStatus } from "@/components/ui/trial-status-badge";
import { TrialResolutionDialog } from "./trial-resolution-dialog";
import { TransferDialog } from "@/components/transfers/transfer-dialog";
import { toggleUncertain } from "@/lib/actions/students";
import type { TransferReason, TransferGroup } from "@/lib/queries/transfers";

type MembershipRow = {
  id: string;
  joinDate: Date;
  leaveDate: Date | null;
  isTrial: boolean;
  wasTrialOriginally: boolean;
  lessonsStart: number | null;
  comment: string | null;
  student: {
    id: string;
    crmCode: string;
    firstName: string;
    lastName: string;
    phone: string;
    status: string;
    isUncertain: boolean;
  };
  paymentPeriods: {
    periodYear: number;
    periodMonth: number;
    amountDue: number;
    amountPaid: number;
    paymentStatus: string;
  }[];
};

function isStale(membership: MembershipRow): boolean {
  if (!membership.isTrial || membership.leaveDate) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return membership.joinDate < today;
}

function getCurrentMonthPaymentInfo(periods: MembershipRow["paymentPeriods"]) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return periods.find((p) => p.periodYear === year && p.periodMonth === month);
}

function UncertainToggle({
  studentId,
  isUncertain,
}: {
  studentId: string;
  isUncertain: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await toggleUncertain(studentId, !isUncertain);
        });
      }}
      className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
        isUncertain
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
          : "text-muted-foreground hover:bg-muted"
      }`}
      title={
        isUncertain
          ? "Click to clear uncertain flag"
          : "Click to mark as uncertain"
      }
    >
      {isPending ? "..." : isUncertain ? "Yes" : "—"}
    </button>
  );
}

export function StudentList({
  memberships,
  groupId,
  groupType,
  currentGroupPublicId,
  transferReasons,
  availableGroups,
  trialMembershipIdsWithAttendance,
  activeTrialStudentIdsWithAttendance,
}: {
  memberships: MembershipRow[];
  groupId: string;
  groupType: string;
  currentGroupPublicId?: string;
  transferReasons?: TransferReason[];
  availableGroups?: TransferGroup[];
  trialMembershipIdsWithAttendance?: Set<string>;
  activeTrialStudentIdsWithAttendance?: Set<string>;
}) {
  const active = memberships.filter((m) => !m.leaveDate);
  const past = memberships.filter((m) => m.leaveDate);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Students</h3>

      {active.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No students in this group yet.
        </p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">CRM</th>
                <th className="px-3 py-2 text-left font-medium">Start</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Phone</th>
                <th className="px-3 py-2 text-left font-medium">Uncertain</th>
                <th className="px-3 py-2 text-left font-medium">
                  Lessons Start
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  Lessons Paid
                </th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Comment</th>
                <th className="px-3 py-2 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {active.map((m, index) => {
                const stale = isStale(m);
                const currentPeriod = getCurrentMonthPaymentInfo(
                  m.paymentPeriods,
                );
                return (
                  <tr
                    key={m.id}
                    className={`border-t ${stale ? "bg-amber-50" : ""}`}
                  >
                    <td className="text-muted-foreground px-3 py-2">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 font-mono">{m.student.crmCode}</td>
                    <td className="px-3 py-2">
                      {new Date(m.joinDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/students/${m.student.id}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {m.student.firstName} {m.student.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{m.student.phone}</td>
                    <td className="px-3 py-2">
                      <UncertainToggle
                        studentId={m.student.id}
                        isUncertain={m.student.isUncertain}
                      />
                    </td>
                    <td className="px-3 py-2">{m.lessonsStart ?? "—"}</td>
                    <td className="px-3 py-2">
                      {m.isTrial ? (
                        "—"
                      ) : currentPeriod ? (
                        <StatusBadge
                          type="payment"
                          value={currentPeriod.paymentStatus}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {m.isTrial && (
                          <Badge
                            variant="outline"
                            className={
                              stale
                                ? "border-amber-400 bg-amber-100 text-amber-800"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                            }
                          >
                            Trial{stale ? " (stale)" : ""}
                          </Badge>
                        )}
                        {!m.isTrial && (
                          <StatusBadge
                            type="student"
                            value={m.student.status}
                          />
                        )}
                      </div>
                    </td>
                    <td className="text-muted-foreground max-w-[150px] truncate px-3 py-2">
                      {m.comment ?? ""}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {m.isTrial && (
                          <TrialResolutionDialog
                            membershipId={m.id}
                            studentName={`${m.student.firstName} ${m.student.lastName}`}
                            groupId={groupId}
                            groupType={groupType}
                            hasAttendance={activeTrialStudentIdsWithAttendance?.has(m.student.id) ?? false}
                          />
                        )}
                        {!m.isTrial &&
                          transferReasons &&
                          availableGroups &&
                          currentGroupPublicId && (
                            <TransferDialog
                              membershipId={m.id}
                              studentName={`${m.student.firstName} ${m.student.lastName}`}
                              currentGroupPublicId={currentGroupPublicId}
                              transferReasons={transferReasons}
                              availableGroups={availableGroups}
                            />
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Past members */}
      {past.length > 0 && (
        <details className="mt-4">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
            Past members ({past.length})
          </summary>
          <div className="mt-2 rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">CRM</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Joined</th>
                  <th className="px-3 py-2 text-left font-medium">Left</th>
                  <th className="px-3 py-2 text-left font-medium">Trial</th>
                </tr>
              </thead>
              <tbody>
                {past.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{m.student.crmCode}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/students/${m.student.id}`}
                        className="text-primary hover:underline"
                      >
                        {m.student.firstName} {m.student.lastName}
                      </Link>
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
                      {m.wasTrialOriginally && (
                        <TrialStatusBadge
                          status={getTrialStatus(
                            m.isTrial,
                            trialMembershipIdsWithAttendance?.has(m.id) ?? false,
                          )}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
