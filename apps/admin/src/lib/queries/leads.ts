import { prisma } from "@/server/db";
import type { LeadStatus } from "@eng/database";

/**
 * Fetch leads, optionally filtered by status. The default tab on /leads is
 * Active (NEW + CONTACTED) — restricting the query at the source avoids
 * shipping the long tail of LOST/CONVERTED rows on every page load.
 */
export async function getLeads(opts?: { statuses?: LeadStatus[] }) {
  return prisma.lead.findMany({
    where: opts?.statuses ? { status: { in: opts.statuses } } : undefined,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      language: true,
      lessonPreference: true,
      selfAssessedLevel: true,
      status: true,
      adminNote: true,
      preferredDays: true,
      preferredDaysAny: true,
      preferredTimeSlots: true,
      preferredTimeSlotsAny: true,
      preferredLanguage: true,
      testSentAt: true,
      testLevelSent: true,
      testScore: true,
      testScoredAt: true,
      nextCallbackAt: true,
      lostReason: true,
      lostReasonOther: true,
      createdAt: true,
      updatedAt: true,
    },
    // Surfaces callbacks first; the in-memory urgency sort layered on top (Phase 4)
    // refines this further with the dot/chip tiers.
    orderBy: [
      { nextCallbackAt: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });
}

export async function getNewLeadCount() {
  return prisma.lead.count({ where: { status: "NEW" } });
}

export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      language: true,
      lessonPreference: true,
      selfAssessedLevel: true,
      status: true,
      adminNote: true,
      preferredDays: true,
      preferredDaysAny: true,
      preferredTimeSlots: true,
      preferredTimeSlotsAny: true,
      preferredLanguage: true,
      testSentAt: true,
      testLevelSent: true,
      testScore: true,
      testScoredAt: true,
      nextCallbackAt: true,
      lostReason: true,
      lostReasonOther: true,
      createdAt: true,
      updatedAt: true,
      student: { select: { id: true, crmCode: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          metadata: true,
          createdAt: true,
          actor: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      // Outgoing SMS for this lead (greeting on creation, manual callback
      // reminders). After conversion these rows stay linked to the Lead;
      // the student page merges this with student-side rows via Student.leadId.
      smsHistory: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          phone: true,
          message: true,
          language: true,
          sentAt: true,
          status: true,
          deliveredAt: true,
          failureReason: true,
          template: { select: { code: true } },
          sentBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
}

export async function getLeadForPrefill(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      note: true,
      language: true,
      lessonPreference: true,
      selfAssessedLevel: true,
      status: true,
      preferredDays: true,
      preferredDaysAny: true,
      preferredTimeSlots: true,
      preferredTimeSlotsAny: true,
      preferredLanguage: true,
      testLevelSent: true,
      testScore: true,
      student: { select: { id: true, crmCode: true } },
    },
  });
}
