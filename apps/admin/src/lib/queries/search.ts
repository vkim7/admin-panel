import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import type { LeadStatus, StudentStatus } from "@eng/database";

export type StudentSearchHit = {
  kind: "student";
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: StudentStatus;
  isUncertain: boolean;
  lostReasonName: string | null;
  activeGroup: { id: string; publicId: string } | null;
  hasOverduePeriod: boolean;
  linkedLead: { id: string; status: LeadStatus } | null;
  createdAt: Date;
};

export type LeadSearchHit = {
  kind: "lead";
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: LeadStatus;
  createdAt: Date;
};

export type SearchHit = StudentSearchHit | LeadSearchHit;

const MIN_QUERY_DIGITS = 3;
const PER_TABLE_LIMIT = 25;

/**
 * Strip non-digits and drop a leading 0 (local form like 050... → 50...).
 * Stored phones are always "+998" + 9 digits, so any subset of the trailing
 * digits will substring-match the column.
 */
function normalizePhoneQuery(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

export async function searchByPhone(rawQuery: string): Promise<SearchHit[]> {
  await requireAdmin();

  const digits = normalizePhoneQuery(rawQuery);
  if (digits.length < MIN_QUERY_DIGITS) return [];

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  const [students, leads] = await Promise.all([
    prisma.student.findMany({
      where: { phone: { contains: digits } },
      take: PER_TABLE_LIMIT,
      select: {
        id: true,
        crmCode: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        isUncertain: true,
        createdAt: true,
        lostReason: { select: { name: true } },
        lead: { select: { id: true, status: true } },
        groupMemberships: {
          where: { leaveDate: null },
          take: 1,
          orderBy: { joinDate: "desc" },
          select: { group: { select: { id: true, publicId: true } } },
        },
        paymentPeriods: {
          where: {
            paymentStatus: { not: "PAID" },
            OR: [
              { periodYear: { lt: currentYear } },
              { periodYear: currentYear, periodMonth: { lte: currentMonth } },
            ],
          },
          take: 1,
          select: { id: true },
        },
      },
    }),
    prisma.lead.findMany({
      where: { phone: { contains: digits } },
      take: PER_TABLE_LIMIT,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  // Collapse: any Lead that has already been converted to a returned Student
  // is hidden — its origin shows up inline on the Student row via linkedLead.
  const convertedLeadIds = new Set(
    students.map((s) => s.lead?.id).filter((v): v is string => Boolean(v)),
  );

  const studentHits: StudentSearchHit[] = students.map((s) => ({
    kind: "student",
    id: s.id,
    crmCode: s.crmCode,
    firstName: s.firstName,
    lastName: s.lastName,
    phone: s.phone,
    status: s.status,
    isUncertain: s.isUncertain,
    lostReasonName: s.lostReason?.name ?? null,
    activeGroup: s.groupMemberships[0]?.group ?? null,
    hasOverduePeriod: s.paymentPeriods.length > 0,
    linkedLead: s.lead,
    createdAt: s.createdAt,
  }));

  const leadHits: LeadSearchHit[] = leads
    .filter((l) => !convertedLeadIds.has(l.id))
    .map((l) => ({
      kind: "lead",
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      phone: l.phone,
      status: l.status,
      createdAt: l.createdAt,
    }));

  return [...studentHits, ...leadHits].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}
