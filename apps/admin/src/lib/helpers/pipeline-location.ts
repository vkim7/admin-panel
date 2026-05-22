import type { LeadSearchHit, StudentSearchHit } from "@/lib/queries/search";

export type PipelineLocation = {
  label: string;
  href: string;
  color: string;
};

/**
 * Derive the operational "where is this record" answer for a Student.
 * The DB enum (`StudentStatus`) alone doesn't capture sub-states the ops team
 * thinks in (Uncertain, No-payment overlay on an ACTIVE student, etc.) — this
 * helper folds the relevant flags into a single label + deep-link.
 *
 * Priority order matters: INACTIVE wins over everything (the student is gone);
 * isUncertain wins over lifecycle states because that's the queue they appear
 * in operationally.
 */
export function getStudentLocation(s: StudentSearchHit): PipelineLocation {
  if (s.status === "INACTIVE") {
    return {
      label: s.lostReasonName ? `Lost — ${s.lostReasonName}` : "Lost list",
      href: "/lost",
      color: "bg-slate-100 text-slate-700",
    };
  }

  if (s.isUncertain) {
    return {
      label: "Uncertain",
      href: "/uncertain",
      color: "bg-yellow-100 text-yellow-800",
    };
  }

  if (s.status === "AWAITING_ASSIGNMENT") {
    return {
      label: "Reception",
      href: "/reception",
      color: "bg-blue-100 text-blue-700",
    };
  }

  if (s.status === "AWAITING_REASSIGNMENT") {
    return {
      label: "Reassignment",
      href: "/reassignment",
      color: "bg-purple-100 text-purple-700",
    };
  }

  // ACTIVE — surface no-payment overlay (if any) ahead of group, since that's
  // the action item; otherwise link to the active group.
  if (s.hasOverduePeriod) {
    return {
      label: s.activeGroup
        ? `Active — No payment (${s.activeGroup.publicId})`
        : "Active — No payment",
      href: "/payments",
      color: "bg-red-100 text-red-700",
    };
  }

  if (s.activeGroup) {
    return {
      label: `Active — ${s.activeGroup.publicId}`,
      href: `/groups/${s.activeGroup.id}`,
      color: "bg-green-100 text-green-700",
    };
  }

  return {
    label: "Active",
    href: `/students/${s.id}`,
    color: "bg-green-100 text-green-700",
  };
}

const LEAD_STATUS_LABELS: Record<LeadSearchHit["status"], string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  LOST: "Lost",
};

const LEAD_STATUS_COLORS: Record<LeadSearchHit["status"], string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-amber-100 text-amber-700",
  CONVERTED: "bg-green-100 text-green-700",
  LOST: "bg-slate-100 text-slate-600",
};

export function getLeadLocation(l: LeadSearchHit): PipelineLocation {
  return {
    label: LEAD_STATUS_LABELS[l.status],
    href: "/leads",
    color: LEAD_STATUS_COLORS[l.status],
  };
}
