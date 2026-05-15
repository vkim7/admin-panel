"use server";

import { requireAdmin } from "@/lib/auth";
import { getLeadDetail, getLeads } from "@/lib/queries/leads";
import type { LeadStatus } from "@eng/database";

/**
 * Client-callable wrappers around the read queries. Used by the leads page to:
 *   1) Lazily fetch non-default tabs (LOST / CONVERTED / ALL).
 *   2) Load the drawer detail when admin clicks a row, without coupling to URL.
 *
 * These bend the "no reads in server actions" rule for ON-DEMAND single
 * requests — they're not in a hot loop and don't queue with each other.
 */

export async function fetchLeadDetailAction(id: string) {
  await requireAdmin();
  return getLeadDetail(id);
}

export async function fetchLeadsByTabAction(statuses: LeadStatus[]) {
  await requireAdmin();
  return getLeads({ statuses });
}
