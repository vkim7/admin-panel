import type { PrismaClient } from "@eng/database";
import type { LevelCategory, GroupType } from "@eng/database";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Look up the applicable price per lesson for a given level category, group type,
 * and date. Returns the most recent PriceSetting where effectiveFrom <= asOfDate.
 */
export async function getApplicablePrice(
  levelCategory: LevelCategory,
  groupType: GroupType,
  asOfDate: Date,
  tx: TxClient,
): Promise<number> {
  const setting = await tx.priceSetting.findFirst({
    where: {
      levelCategory,
      groupType,
      effectiveFrom: { lte: asOfDate },
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!setting) {
    throw new Error(
      `No PriceSetting found for ${levelCategory}/${groupType} as of ${asOfDate.toISOString()}`,
    );
  }

  return setting.pricePerLesson;
}

/**
 * Build payment period records for a membership based on pre-created lesson dates.
 * Groups lessons by calendar month, calculates amountDue, flags first month as partial if needed.
 *
 * @returns Array of data objects ready for StudentPaymentPeriod.createMany
 */
export function buildPaymentPeriods(
  lessonDates: Date[],
  joinDate: Date,
  pricePerLesson: number,
  studentId: string,
  groupId: string,
  membershipId: string,
): {
  studentId: string;
  groupId: string;
  groupMembershipId: string;
  periodYear: number;
  periodMonth: number;
  totalLessons: number;
  pricePerLesson: number;
  amountDue: number;
  discountAmount: number;
  isPartialPeriod: boolean;
}[] {
  // Filter lesson dates to those on or after joinDate
  const joinDateUTC = new Date(
    Date.UTC(
      joinDate.getUTCFullYear(),
      joinDate.getUTCMonth(),
      joinDate.getUTCDate(),
    ),
  );

  const relevantDates = lessonDates.filter((d) => d >= joinDateUTC);

  // Group by year-month
  const byMonth = new Map<string, Date[]>();
  for (const date of relevantDates) {
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
    const existing = byMonth.get(key) ?? [];
    existing.push(date);
    byMonth.set(key, existing);
  }

  const joinDay = joinDate.getUTCDate();
  let isFirst = true;

  const periods: ReturnType<typeof buildPaymentPeriods> = [];

  // Sort by year-month
  const sortedKeys = [...byMonth.keys()].sort();

  for (const key of sortedKeys) {
    const dates = byMonth.get(key)!;
    const [yearStr, monthStr] = key.split("-");
    const year = parseInt(yearStr!, 10);
    const month = parseInt(monthStr!, 10);
    const totalLessons = dates.length;
    const amountDue = totalLessons * pricePerLesson;

    periods.push({
      studentId,
      groupId,
      groupMembershipId: membershipId,
      periodYear: year,
      periodMonth: month,
      totalLessons,
      pricePerLesson,
      amountDue,
      discountAmount: 0, // Promotions deferred to Phase 12
      isPartialPeriod: isFirst && joinDay > 1,
    });

    isFirst = false;
  }

  return periods;
}
