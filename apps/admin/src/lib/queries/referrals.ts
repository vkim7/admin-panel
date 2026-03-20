import { prisma } from "@/server/db";

export async function getStudentReferrals(studentId: string) {
  const [referralsMade, referralReceived] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerStudentId: studentId },
      include: {
        referred: {
          select: { id: true, crmCode: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.referral.findUnique({
      where: { referredStudentId: studentId },
      include: {
        referrer: {
          select: { id: true, crmCode: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);

  return { referralsMade, referralReceived };
}

export type ReferralsMade = Awaited<ReturnType<typeof getStudentReferrals>>["referralsMade"];
export type ReferralReceived = Awaited<ReturnType<typeof getStudentReferrals>>["referralReceived"];
