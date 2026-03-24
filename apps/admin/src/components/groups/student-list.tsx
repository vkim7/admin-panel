"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrialStatusBadge, getTrialStatus } from "@/components/ui/trial-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TrialActionsMenu } from "./trial-resolution-dialog";
import { TransferDialog } from "@/components/transfers/transfer-dialog";
import { toggleUncertain, sendToReassignment, sendToLostList } from "@/lib/actions/students";
import { getAge } from "@/lib/helpers/date";
import type { TransferReason, TransferGroup } from "@/lib/queries/transfers";

type LostReason = {
  id: string;
  name: string;
  isOther: boolean;
};

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
    dateOfBirth: Date;
    status: string;
    isUncertain: boolean;
  };
  paymentPeriods: {
    periodYear: number;
    periodMonth: number;
    amountDue: number;
    discountAmount: number;
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

function MemberActionsMenu({
  studentId,
  membershipId,
  studentName,
  transferReasons,
  availableGroups,
  currentGroupPublicId,
  lostReasons,
}: {
  studentId: string;
  membershipId: string;
  studentName: string;
  transferReasons?: TransferReason[];
  availableGroups?: TransferGroup[];
  currentGroupPublicId?: string;
  lostReasons?: LostReason[];
}) {
  const [isPending, startTransition] = useTransition();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");

  const selectedReason = lostReasons?.find((r) => r.id === selectedReasonId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {transferReasons && availableGroups && currentGroupPublicId && (
            <DropdownMenuItem onSelect={() => setTransferOpen(true)}>
              Transfer
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setReassignOpen(true)}>
            Send to Reassignment
          </DropdownMenuItem>
          {lostReasons && (
            <DropdownMenuItem onSelect={() => setLostOpen(true)}>
              Send to Lost list
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Transfer dialog */}
      {transferReasons && availableGroups && currentGroupPublicId && (
        <TransferDialog
          membershipId={membershipId}
          studentName={studentName}
          currentGroupPublicId={currentGroupPublicId}
          transferReasons={transferReasons}
          availableGroups={availableGroups}
          open={transferOpen}
          onOpenChange={setTransferOpen}
        />
      )}

      {/* Reassignment confirmation */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Reassignment</DialogTitle>
            <DialogDescription>
              {studentName} will be removed from this group. If they have no other active groups, their status will change to Awaiting Reassignment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await sendToReassignment(studentId, membershipId);
                  if (result?.error) {
                    toast.error(result.error);
                  } else {
                    toast.success(`${studentName} sent to reassignment`);
                    setReassignOpen(false);
                  }
                });
              }}
            >
              {isPending ? "..." : "Send to Reassignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Lost list dialog */}
      <Dialog
        open={lostOpen}
        onOpenChange={(v) => {
          setLostOpen(v);
          if (!v) {
            setSelectedReasonId("");
            setOtherReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Lost list</DialogTitle>
            <DialogDescription>
              {studentName} will be removed from this group. If they have no other active groups, they will be deactivated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason for leaving</Label>
              <Select onValueChange={setSelectedReasonId} value={selectedReasonId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {(lostReasons ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedReason?.isOther && (
              <div className="space-y-2">
                <Label>Please specify</Label>
                <Textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Why is the student leaving?"
                  rows={2}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLostOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!selectedReasonId || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await sendToLostList(studentId, membershipId, {
                    lostReasonId: selectedReasonId,
                    otherLostReason: otherReason || null,
                  });
                  if (result?.error) {
                    toast.error(result.error);
                  } else if ("success" in result) {
                    toast.success(`${studentName} sent to lost list`);
                    setLostOpen(false);
                  }
                });
              }}
            >
              {isPending ? "..." : "Send to Lost list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  lostReasons,
}: {
  memberships: MembershipRow[];
  groupId: string;
  groupType: string;
  currentGroupPublicId?: string;
  transferReasons?: TransferReason[];
  availableGroups?: TransferGroup[];
  trialMembershipIdsWithAttendance?: Set<string>;
  lostReasons?: LostReason[];
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
                <th className="px-3 py-2 text-left font-medium">Age</th>
                <th className="px-3 py-2 text-left font-medium">Uncertain</th>
                <th className="px-3 py-2 text-left font-medium">
                  Lessons Start
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  Lessons Paid
                </th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Comment</th>
                <th className="px-3 py-2 text-left font-medium">Actions</th>
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
                    <td className="px-3 py-2">{getAge(m.student.dateOfBirth)}</td>
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
                        <div className="flex items-center gap-1.5">
                          <StatusBadge
                            type="payment"
                            value={currentPeriod.paymentStatus}
                          />
                          {currentPeriod.paymentStatus !== "PAID" &&
                            (() => {
                              const rem = currentPeriod.amountDue - currentPeriod.discountAmount - currentPeriod.amountPaid;
                              return rem > 0 ? (
                                <span className="text-xs text-destructive">
                                  {rem.toLocaleString("en-US")}
                                </span>
                              ) : null;
                            })()}
                        </div>
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
                          <TrialActionsMenu
                            membershipId={m.id}
                            studentId={m.student.id}
                            studentName={`${m.student.firstName} ${m.student.lastName}`}
                            groupType={groupType}
                            hasAttendance={trialMembershipIdsWithAttendance?.has(m.id) ?? false}
                            lostReasons={lostReasons}
                            availableGroups={availableGroups}
                            currentGroupPublicId={currentGroupPublicId}
                          />
                        )}
                        {!m.isTrial && (
                          <MemberActionsMenu
                            studentId={m.student.id}
                            membershipId={m.id}
                            studentName={`${m.student.firstName} ${m.student.lastName}`}
                            transferReasons={transferReasons}
                            availableGroups={availableGroups}
                            currentGroupPublicId={currentGroupPublicId}
                            lostReasons={lostReasons}
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
