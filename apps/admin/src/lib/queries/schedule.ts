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
};

export type ScheduleTeacherRow = {
  id: string;
  name: string;
  slots: Record<string, ScheduleCell | null>;
  // Which empty slots the teacher is available for (based on TeacherAvailability)
  availableSlots: Set<string>;
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
  ): Set<string> {
    // Get availability records that match any day in the pattern
    const matchingAvail = availability.filter((a) =>
      dayPattern.includes(a.dayOfWeek),
    );
    if (matchingAvail.length === 0) return new Set();

    const available = new Set<string>();
    for (const slot of TIME_SLOTS) {
      if (matchingAvail.some((a) => isSlotInRange(slot, a.startTime, a.endTime))) {
        available.add(slot);
      }
    }
    return available;
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
          slots: emptySlots(),
          availableSlots: avail,
        });
      }

      const row = map.get(teacher.id)!;
      const activeMembers = group.memberships;
      const trialCount = activeMembers.filter((m) => m.isTrial).length;

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
      };

      if (row.slots[group.startTime] !== undefined) {
        row.slots[group.startTime] = cell;
      }
    }

    // Also add teacher rows for day patterns where they have availability
    // but no groups yet (so empty available slots show "+")
    if (mwfAvail.size > 0 && !mwfMap.has(teacher.id)) {
      mwfMap.set(teacher.id, {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        slots: emptySlots(),
        availableSlots: mwfAvail,
      });
    }
    if (ttsAvail.size > 0 && !ttsMap.has(teacher.id)) {
      ttsMap.set(teacher.id, {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        slots: emptySlots(),
        availableSlots: ttsAvail,
      });
    }
  }

  // ===== TODO: REMOVE — hardcoded mock data for visual testing =====
  const mockCell = (
    overrides: Partial<ScheduleCell> & Pick<ScheduleCell, "publicId" | "level" | "progressStage">,
  ): ScheduleCell => ({
    groupId: "mock",
    type: "GROUP",
    activeCount: 4,
    trialCount: 0,
    maxStudents: 6,
    paidCount: 4,
    ...overrides,
  });

  const mockSlots = (): Record<string, ScheduleCell | null> => {
    const s: Record<string, ScheduleCell | null> = {};
    for (const t of TIME_SLOTS) s[t] = null;
    return s;
  };

  // Teacher A — covers many level+stage combos
  const mockA = mockSlots();
  mockA["08:30"] = mockCell({ publicId: "GR-10", level: "BEGINNER", progressStage: "BEGINNING", activeCount: 6, maxStudents: 6, paidCount: 6 });
  mockA["10:00"] = mockCell({ publicId: "GR-11", level: "ELEMENTARY", progressStage: "MID", activeCount: 3, maxStudents: 6, paidCount: 2, trialCount: 1 });
  mockA["11:30"] = mockCell({ publicId: "GR-12", level: "PRE_INTERMEDIATE", progressStage: "FINAL", activeCount: 5, maxStudents: 6, paidCount: 5 });
  mockA["14:30"] = mockCell({ publicId: "GR-13", level: "INTERMEDIATE", progressStage: "BEGINNING", activeCount: 6, maxStudents: 6, paidCount: 4 });
  mockA["16:00"] = mockCell({ publicId: "IND-5", level: "IELTS", progressStage: "MID", type: "INDIVIDUAL", activeCount: 1, maxStudents: 1, paidCount: 1 });
  mockA["17:30"] = mockCell({ publicId: "GR-14", level: "UPPER_INTERMEDIATE", progressStage: "FINAL", activeCount: 4, maxStudents: 6, paidCount: 3 });

  // Teacher B — sparser, different combos
  const mockB = mockSlots();
  mockB["07:00"] = mockCell({ publicId: "GR-20", level: "ELEMENTARY", progressStage: "BEGINNING", activeCount: 5, maxStudents: 6, paidCount: 5 });
  mockB["10:00"] = mockCell({ publicId: "GR-21", level: "INTERMEDIATE", progressStage: "MID", activeCount: 6, maxStudents: 6, paidCount: 6 });
  mockB["13:00"] = mockCell({ publicId: "IND-8", level: "BEGINNER", progressStage: "MID", type: "INDIVIDUAL", activeCount: 1, maxStudents: 1, paidCount: 0 });
  mockB["19:00"] = mockCell({ publicId: "GR-22", level: "PRE_INTERMEDIATE", progressStage: "BEGINNING", activeCount: 2, maxStudents: 6, paidCount: 2, trialCount: 1 });
  mockB["20:30"] = mockCell({ publicId: "GR-23", level: "IELTS", progressStage: "FINAL", activeCount: 4, maxStudents: 6, paidCount: 4 });

  // Teacher C — edge cases
  const mockC = mockSlots();
  mockC["08:30"] = mockCell({ publicId: "GR-30", level: "UPPER_INTERMEDIATE", progressStage: "MID", activeCount: 3, maxStudents: 6, paidCount: 0, trialCount: 2 });
  mockC["14:30"] = mockCell({ publicId: "IND-9", level: "ELEMENTARY", progressStage: "FINAL", type: "INDIVIDUAL", activeCount: 1, maxStudents: 1, paidCount: 1 });
  mockC["17:30"] = mockCell({ publicId: "GR-31", level: "INTERMEDIATE", progressStage: "FINAL", activeCount: 6, maxStudents: 6, paidCount: 5 });
  mockC["22:00"] = mockCell({ publicId: "GR-32", level: "BEGINNER", progressStage: "BEGINNING", activeCount: 1, maxStudents: 6, paidCount: 0 });

  const allSlots = new Set(TIME_SLOTS as readonly string[]);
  mwfMap.set("mock-a", { id: "mock-a", name: "Mock Teacher A", slots: mockA, availableSlots: allSlots });
  mwfMap.set("mock-b", { id: "mock-b", name: "Mock Teacher B", slots: mockB, availableSlots: allSlots });
  ttsMap.set("mock-c", { id: "mock-c", name: "Mock Teacher C", slots: mockC, availableSlots: allSlots });
  // ===== END mock data =====

  return {
    mwf: [...mwfMap.values()],
    tts: [...ttsMap.values()],
  };
}
