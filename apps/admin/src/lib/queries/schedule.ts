import { prisma } from "@/server/db";
import { TIME_SLOTS } from "@/lib/constants";
import { getProgressStage } from "@/lib/helpers/lesson-generation";

export type ScheduleCell = {
  groupId: string;
  publicId: string;
  type: "GROUP" | "INDIVIDUAL";
  level: string;
  progressStage: "BEGINNING" | "MID" | "FINAL";
  activeCount: number;
  trialCount: number;
  maxStudents: number;
  paidCount: number;
  language: "UZ" | "RU" | null; // null = both (default, not shown)
};

export type ScheduleTeacherRow = {
  id: string;
  name: string;
  teachingLanguage: "UZBEK" | "RUSSIAN" | "ANY";
  slots: Record<string, ScheduleCell | null>;
  // Which empty slots the teacher is available for (based on TeacherAvailability)
  availableSlots: string[];
};

export type ScheduleData = {
  mwf: ScheduleTeacherRow[];
  tts: ScheduleTeacherRow[];
};

function getDayPatternKey(days: number[]): "mwf" | "tts" | null {
  const sorted = [...days].sort().join(",");
  if (sorted === "1,3,5") return "mwf";
  if (sorted === "2,4,6") return "tts";
  return null;
}

/**
 * Check if a time slot falls within an availability window.
 * Availability has startTime and endTime (e.g. "14:30"–"22:00").
 * A slot is available if slot >= startTime && slot < endTime.
 */
function isSlotInRange(slot: string, availStart: string, availEnd: string): boolean {
  return slot >= availStart && slot < availEnd;
}

export async function getScheduleData(): Promise<ScheduleData> {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  // Query 1: Active teachers with groups + memberships + availability
  const teachers = await prisma.teacher.findMany({
    where: { isActive: true },
    orderBy: { firstName: "asc" },
    include: {
      groups: {
        where: { isActive: true },
        select: {
          id: true,
          publicId: true,
          type: true,
          level: true,
          days: true,
          startTime: true,
          startDate: true,
          endDate: true,
          maxStudents: true,
          memberships: {
            where: { leaveDate: null },
            select: { id: true, isTrial: true },
          },
        },
      },
      availability: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
  });

  // Query 2: Paid counts for current month by groupId
  const paidPeriods = await prisma.studentPaymentPeriod.groupBy({
    by: ["groupId"],
    where: {
      periodYear: currentYear,
      periodMonth: currentMonth,
      paymentStatus: "PAID",
    },
    _count: { id: true },
  });

  const paidByGroup = new Map(
    paidPeriods.map((p) => [p.groupId, p._count.id]),
  );

  // Build empty slot template
  const emptySlots = (): Record<string, ScheduleCell | null> => {
    const slots: Record<string, ScheduleCell | null> = {};
    for (const t of TIME_SLOTS) {
      slots[t] = null;
    }
    return slots;
  };

  // Compute available time slots for a teacher on a given day pattern
  function getAvailableSlots(
    availability: { dayOfWeek: number; startTime: string; endTime: string }[],
    dayPattern: number[],
  ): string[] {
    // Get availability records that match any day in the pattern
    const matchingAvail = availability.filter((a) =>
      dayPattern.includes(a.dayOfWeek),
    );
    if (matchingAvail.length === 0) return [];

    return TIME_SLOTS.filter((slot) =>
      matchingAvail.some((a) => isSlotInRange(slot, a.startTime, a.endTime)),
    );
  }

  // Accumulate rows per day pattern
  const mwfMap = new Map<string, ScheduleTeacherRow>();
  const ttsMap = new Map<string, ScheduleTeacherRow>();

  for (const teacher of teachers) {
    const mwfAvail = getAvailableSlots(teacher.availability, [1, 3, 5]);
    const ttsAvail = getAvailableSlots(teacher.availability, [2, 4, 6]);

    // Place groups into grids
    for (const group of teacher.groups) {
      const pattern = getDayPatternKey(group.days);
      if (!pattern) continue;

      const map = pattern === "mwf" ? mwfMap : ttsMap;
      const avail = pattern === "mwf" ? mwfAvail : ttsAvail;

      if (!map.has(teacher.id)) {
        map.set(teacher.id, {
          id: teacher.id,
          name: `${teacher.firstName} ${teacher.lastName}`,
          teachingLanguage: teacher.teachingLanguage as "UZBEK" | "RUSSIAN" | "ANY",
          slots: emptySlots(),
          availableSlots: avail,
        });
      }

      const row = map.get(teacher.id)!;
      const activeMembers = group.memberships;
      const trialCount = activeMembers.filter((m) => m.isTrial).length;

      // Language: only show if teacher speaks exactly one language (ANY = both = not shown)
      const lang: "UZ" | "RU" | null =
        teacher.teachingLanguage === "UZBEK" ? "UZ" :
        teacher.teachingLanguage === "RUSSIAN" ? "RU" :
        null;

      const cell: ScheduleCell = {
        groupId: group.id,
        publicId: group.publicId,
        type: group.type as "GROUP" | "INDIVIDUAL",
        level: group.level,
        progressStage: getProgressStage(group.startDate, group.endDate),
        activeCount: activeMembers.length,
        trialCount,
        maxStudents: group.maxStudents,
        paidCount: paidByGroup.get(group.id) ?? 0,
        language: lang,
      };

      if (row.slots[group.startTime] !== undefined) {
        row.slots[group.startTime] = cell;
      }
    }

    // Also add teacher rows for day patterns where they have availability
    // but no groups yet (so empty available slots show "+")
    if (mwfAvail.length > 0 && !mwfMap.has(teacher.id)) {
      mwfMap.set(teacher.id, {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        teachingLanguage: teacher.teachingLanguage as "UZBEK" | "RUSSIAN" | "ANY",
        slots: emptySlots(),
        availableSlots: mwfAvail,
      });
    }
    if (ttsAvail.length > 0 && !ttsMap.has(teacher.id)) {
      ttsMap.set(teacher.id, {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        teachingLanguage: teacher.teachingLanguage as "UZBEK" | "RUSSIAN" | "ANY",
        slots: emptySlots(),
        availableSlots: ttsAvail,
      });
    }
  }

  return {
    mwf: [...mwfMap.values()],
    tts: [...ttsMap.values()],
  };
}
