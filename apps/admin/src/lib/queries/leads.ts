import { prisma } from "@/server/db";

export async function getLeads() {
  return prisma.lead.findMany({
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
      adminNote: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getNewLeadCount() {
  return prisma.lead.count({ where: { status: "NEW" } });
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
      student: { select: { id: true, crmCode: true } },
    },
  });
}
