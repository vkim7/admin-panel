import type { Level, LeadStatus, SelfAssessedLevel } from "@eng/database";
import { evaluateConversionGate } from "./lead-conversion-gate";

export const STALE_NEW_HOURS = 24;
export const STALE_CONTACTED_DAYS = 3;
export const TEST_STALE_HOURS = 24;

export type UrgencyTier = "red" | "green" | "blue" | "amber" | "idle";

export type LeadChipKind =
  | "callback-overdue"
  | "callback-scheduled"
  | "test-stale"
  | "untouched"
  | "new-lead"
  | "ready"
  | "half-qualified"
  | "stale";

export type LeadChip = {
  label: string;
  kind: LeadChipKind;
};

export type UrgencyInput = {
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
  selfAssessedLevel: SelfAssessedLevel | null;
  preferredDays: number[];
  preferredDaysAny?: boolean;
  preferredTimeSlots: string[];
  preferredTimeSlotsAny?: boolean;
  testSentAt: Date | null;
  testLevelSent: Level | null;
  testScore: number | null;
  nextCallbackAt: Date | null;
};

export type UrgencyInfo = {
  tier: UrgencyTier;
  chip: LeadChip | null;
};

// Tier ordinals — higher = more urgent. Drives the in-memory sort.
const TIER_RANK: Record<UrgencyTier, number> = {
  red: 4,
  green: 3,
  blue: 2,
  amber: 1,
  idle: 0,
};

export function tierRank(tier: UrgencyTier): number {
  return TIER_RANK[tier];
}

function fmtTashkentTime(date: Date): string {
  return new Date(date).toLocaleString("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTashkentShort(date: Date): string {
  return new Date(date).toLocaleString("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const LEVEL_SHORT: Record<Level, string> = {
  BEGINNER: "BEG",
  ELEMENTARY: "ELEM",
  PRE_INTERMEDIATE: "PRE",
  INTERMEDIATE: "INT",
  UPPER_INTERMEDIATE: "UPPER",
  IELTS: "IELTS",
};

/**
 * Derive urgency tier + row chip for a lead. Pure function — single source of
 * truth for the table's visual prioritisation. LOST and CONVERTED return idle.
 *
 * Priority when multiple conditions apply: red beats blue beats amber. Within
 * a tier, the most informative chip wins (overdue callback over generic stale).
 */
export function getUrgencyInfo(lead: UrgencyInput): UrgencyInfo {
  // Terminal states — no chip.
  if (lead.status === "LOST" || lead.status === "CONVERTED") {
    return { tier: "idle", chip: null };
  }

  const now = Date.now();

  // ─── Status === NEW always gets a chip ───────────────────────────────────
  // Stale (>24h, red) or fresh (<24h, blue). NEW leads by definition have no
  // captured preferences/callback/test, so other rules don't apply.
  if (lead.status === "NEW") {
    const ageHours = (now - new Date(lead.createdAt).getTime()) / 3600000;
    if (ageHours > STALE_NEW_HOURS) {
      const days = Math.floor(ageHours / 24);
      return {
        tier: "red",
        chip: { kind: "untouched", label: `Untouched · ${days}d` },
      };
    }
    return {
      tier: "blue",
      chip: { kind: "new-lead", label: "New" },
    };
  }

  // ─── CONTACTED: red > green > amber > idle ───────────────────────────────

  // Red: overdue callback
  if (lead.nextCallbackAt !== null) {
    const cb = new Date(lead.nextCallbackAt).getTime();
    if (cb < now) {
      return {
        tier: "red",
        chip: {
          kind: "callback-overdue",
          label: `Callback · ${fmtTashkentTime(lead.nextCallbackAt)}`,
        },
      };
    }
  }

  // Red: test sent >24h ago with no score
  if (lead.testSentAt !== null && lead.testScore === null) {
    const ageHours =
      (now - new Date(lead.testSentAt).getTime()) / 3600000;
    if (ageHours > TEST_STALE_HOURS) {
      const lvl = lead.testLevelSent
        ? ` · ${LEVEL_SHORT[lead.testLevelSent]}`
        : "";
      return {
        tier: "red",
        chip: {
          kind: "test-stale",
          label: `Test${lvl} · ${Math.floor(ageHours)}h`,
        },
      };
    }
  }

  // Green: ready to convert (gate satisfied)
  const gate = evaluateConversionGate({
    selfAssessedLevel: lead.selfAssessedLevel,
    preferredDays: lead.preferredDays,
    preferredDaysAny: lead.preferredDaysAny,
    preferredTimeSlots: lead.preferredTimeSlots,
    preferredTimeSlotsAny: lead.preferredTimeSlotsAny,
    testScore: lead.testScore,
  });
  if (gate.ready) {
    return {
      tier: "green",
      chip: { kind: "ready", label: "Ready to convert" },
    };
  }

  // Amber: CONTACTED for >3 days with no progress
  const ageDays = (now - new Date(lead.updatedAt).getTime()) / 86400000;
  if (ageDays > STALE_CONTACTED_DAYS) {
    const days = Math.floor(ageDays);
    return {
      tier: "amber",
      chip: { kind: "stale", label: `Stale ${days}d` },
    };
  }

  // Amber: half-qualified — at least one gate field captured but not all.
  // Surfaces leads mid-conversation so admin doesn't lose them.
  const anyFilled =
    lead.preferredDays.length > 0 ||
    !!lead.preferredDaysAny ||
    lead.preferredTimeSlots.length > 0 ||
    !!lead.preferredTimeSlotsAny ||
    lead.testScore !== null;
  if (anyFilled && gate.missing.length > 0) {
    return {
      tier: "amber",
      chip: { kind: "half-qualified", label: "Half-qualified" },
    };
  }

  // Idle: future callback is informational only, not urgent
  if (lead.nextCallbackAt !== null) {
    return {
      tier: "idle",
      chip: {
        kind: "callback-scheduled",
        label: `Callback · ${fmtTashkentShort(lead.nextCallbackAt)}`,
      },
    };
  }

  return { tier: "idle", chip: null };
}
