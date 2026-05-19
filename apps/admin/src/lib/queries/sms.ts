import { prisma } from "@/server/db";

/**
 * The shape returned to UI components. Stable contract — keep aligned with
 * SmsHistoryList.
 */
export type SmsHistoryRow = Awaited<
  ReturnType<typeof getSmsHistoryForLead>
>[number];

const SMS_HISTORY_SELECT = {
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
} as const;

/**
 * SMS history for a lead (pre-conversion). Returns rows where leadId = X.
 * Ordered by send time (oldest first — natural reading order in a timeline).
 */
export async function getSmsHistoryForLead(leadId: string) {
  return prisma.smsHistory.findMany({
    where: { leadId },
    orderBy: { sentAt: "asc" },
    select: SMS_HISTORY_SELECT,
  });
}

/**
 * Merged SMS history for a student. Returns rows where the student is the
 * direct recipient OR was the recipient as a lead pre-conversion.
 *
 * Pass `leadId` (Student.leadId) so the query picks up greeting/reminder
 * SMSes sent while the record was still a Lead. Pass null if the student
 * wasn't converted from a lead (legacy students, manual creates).
 */
export async function getSmsHistoryForStudent(
  studentId: string,
  leadId: string | null,
) {
  return prisma.smsHistory.findMany({
    where: {
      OR: [
        { studentId },
        ...(leadId ? [{ leadId }] : []),
      ],
    },
    orderBy: { sentAt: "asc" },
    select: SMS_HISTORY_SELECT,
  });
}
