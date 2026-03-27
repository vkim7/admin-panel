import type { PrismaClient } from "@eng/database";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Fields to clear when resolving the uncertain flag */
export const UNCERTAIN_CLEAR_FIELDS = {
  isUncertain: false,
  uncertainFlaggedBy: null,
  uncertainReasonId: null,
  uncertainComment: null,
} as const;

/** Close the most recent open UncertainHistory record for a student */
export async function resolveUncertainHistory(tx: TxClient, studentId: string, adminId: string) {
  const openHistory = await tx.uncertainHistory.findFirst({
    where: { studentId, resolvedAt: null },
    orderBy: { flaggedAt: "desc" },
  });
  if (openHistory) {
    await tx.uncertainHistory.update({
      where: { id: openHistory.id },
      data: { resolvedAt: new Date(), resolvedById: adminId },
    });
  }
}
