"use client";

import { useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { TransferDialog } from "@/components/transfers/transfer-dialog";
import {
  resolveUncertain,
  sendToReassignment,
  sendToLostList,
} from "@/lib/actions/students";
import { LEVEL_SHORT } from "@/lib/constants";
import type { TransferReason, TransferGroup } from "@/lib/queries/transfers";

type LostReason = {
  id: string;
  name: string;
  isOther: boolean;
};

type UncertainStudent = {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  level: string;
  uncertainFlaggedBy: string | null;
  uncertainComment: string | null;
  uncertainReason: { id: string; name: string; isOther: boolean } | null;
  groupMemberships: {
    id: string;
    group: { id: string; publicId: string; type: string; level: string };
  }[];
};

// ── Actions menu per row ────────────────────────────────────────────────────

function UncertainActionsMenu({
  student,
  transferReasons,
  availableGroups,
  lostReasons,
}: {
  student: UncertainStudent;
  transferReasons: TransferReason[];
  availableGroups: TransferGroup[];
  lostReasons: LostReason[];
}) {
  const [isPending, startTransition] = useTransition();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");

  // For multi-membership students, track which membership is selected for the action
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const memberships = student.groupMemberships;
  const singleMembership = memberships.length === 1 ? memberships[0] : null;

  const selectedReason = lostReasons.find((r) => r.id === selectedReasonId);
  const studentName = `${student.firstName} ${student.lastName}`;

  // Get the active membership for per-membership actions
  const activeMembershipId = singleMembership?.id ?? selectedMembershipId;
  const activeGroup = memberships.find((m) => m.id === activeMembershipId);

  function openAction(setter: (v: boolean) => void) {
    if (singleMembership) {
      setSelectedMembershipId(singleMembership.id);
      setter(true);
    } else if (memberships.length > 1) {
      // Reset membership selection for multi-membership
      setSelectedMembershipId("");
      setter(true);
    }
  }

  // Membership selector shown inside action dialogs for multi-membership students
  const membershipSelector = !singleMembership && memberships.length > 1 && (
    <div className="space-y-2">
      <Label>Select group</Label>
      <Select
        onValueChange={setSelectedMembershipId}
        value={selectedMembershipId}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a group..." />
        </SelectTrigger>
        <SelectContent>
          {memberships.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.group.publicId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setResolveOpen(true)}>
            Remove uncertain mark
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openAction(setTransferOpen)}>
            Transfer
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openAction(setReassignOpen)}>
            Send to Reassignment
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openAction(setLostOpen)}>
            Send to Lost list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Resolve uncertain confirmation */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Uncertain Mark</DialogTitle>
            <DialogDescription>
              Clear the uncertain flag for {studentName}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await resolveUncertain(student.id);
                  toast.success(`Uncertain mark removed for ${studentName}`);
                  setResolveOpen(false);
                });
              }}
            >
              {isPending ? "..." : "Remove Mark"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      {activeMembershipId && activeGroup && (
        <TransferDialog
          membershipId={activeMembershipId}
          studentName={studentName}
          currentGroupPublicId={activeGroup.group.publicId}
          transferReasons={transferReasons}
          availableGroups={availableGroups}
          open={transferOpen}
          onOpenChange={setTransferOpen}
        />
      )}
      {/* Transfer with membership selector (multi-membership, no selection yet) */}
      {!singleMembership &&
        memberships.length > 1 &&
        !activeMembershipId &&
        transferOpen && (
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer {studentName}</DialogTitle>
                <DialogDescription>
                  This student is in multiple groups. Select which group to
                  transfer from.
                </DialogDescription>
              </DialogHeader>
              {membershipSelector}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setTransferOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!selectedMembershipId}
                  onClick={() => {
                    // Re-open with the membership selected — TransferDialog will render
                    setTransferOpen(false);
                    setTimeout(() => setTransferOpen(true), 0);
                  }}
                >
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      {/* Send to Reassignment dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Reassignment</DialogTitle>
            <DialogDescription>
              {studentName} will be removed from the selected group. If they
              have no other active groups, their status will change to Awaiting
              Reassignment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">{membershipSelector}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!activeMembershipId || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await sendToReassignment(
                    student.id,
                    activeMembershipId,
                  );
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
              {studentName} will be removed from the selected group. If they
              have no other active groups, they will be deactivated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {membershipSelector}
            <div className="space-y-2">
              <Label>Reason for leaving</Label>
              <Select
                onValueChange={setSelectedReasonId}
                value={selectedReasonId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {lostReasons.map((r) => (
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
              disabled={!activeMembershipId || !selectedReasonId || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await sendToLostList(
                    student.id,
                    activeMembershipId,
                    {
                      lostReasonId: selectedReasonId,
                      otherLostReason: otherReason || null,
                    },
                  );
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

// ── Table columns ───────────────────────────────────────────────────────────

function makeColumns(
  transferReasons: TransferReason[],
  availableGroups: TransferGroup[],
  lostReasons: LostReason[],
): ColumnDef<UncertainStudent>[] {
  return [
    {
      accessorKey: "crmCode",
      header: ({ column }) => (
        <SortableHeader column={column}>CRM</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.crmCode}</span>
      ),
    },
    {
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      id: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>Name</SortableHeader>
      ),
      cell: ({ row }) => (
        <Link
          href={`/students/${row.original.id}`}
          className="text-primary font-medium hover:underline"
        >
          {row.original.firstName} {row.original.lastName}
        </Link>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
    },
    {
      accessorKey: "level",
      header: "Level",
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {LEVEL_SHORT[row.original.level] ?? row.original.level}
        </Badge>
      ),
    },
    {
      id: "group",
      header: "Group",
      cell: ({ row }) => {
        const memberships = row.original.groupMemberships;
        if (memberships.length === 0) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {memberships.map((m) => (
              <Link key={m.id} href={`/groups/${m.group.id}`}>
                <Badge variant="outline" className="hover:bg-accent text-xs">
                  {m.group.publicId}
                </Badge>
              </Link>
            ))}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "reason",
      header: "Reason",
      cell: ({ row }) => {
        const reason = row.original.uncertainReason;
        const comment = row.original.uncertainComment;
        if (!reason) {
          return row.original.uncertainFlaggedBy === "TEACHER" ? (
            <span className="text-muted-foreground text-sm">
              Flagged by teacher
            </span>
          ) : null;
        }
        return (
          <span className="text-sm" title={comment ?? undefined}>
            {reason.name}
            {comment && (
              <span className="text-muted-foreground">: {comment}</span>
            )}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "uncertainFlaggedBy",
      header: "Flagged By",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.uncertainFlaggedBy === "TEACHER" ? "Teacher" : "Admin"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <UncertainActionsMenu
          student={row.original}
          transferReasons={transferReasons}
          availableGroups={availableGroups}
          lostReasons={lostReasons}
        />
      ),
      enableSorting: false,
    },
  ];
}

// ── Table component ─────────────────────────────────────────────────────────

interface UncertainTableProps {
  data: UncertainStudent[];
  transferReasons: TransferReason[];
  availableGroups: TransferGroup[];
  lostReasons: LostReason[];
}

export function UncertainTable({
  data,
  transferReasons,
  availableGroups,
  lostReasons,
}: UncertainTableProps) {
  const columns = makeColumns(transferReasons, availableGroups, lostReasons);

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search by name..."
    />
  );
}
