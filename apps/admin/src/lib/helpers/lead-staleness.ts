import type {
  Level,
  LeadStatus,
  LessonPreference,
  PreferredLanguage,
  SelfAssessedLevel,
} from "@eng/database";
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
  lessonPreference?: LessonPreference | null;
  preferredLanguage?: PreferredLanguage | null;
  dateOfBirth?: Date | null;
  testSentAt: Date | null;
  testLevelSent: Level | null;
  testScore: number | null;
  nextCallbackAt: Date | null;
};

export type UrgencyInfo = {
  tier: UrgencyTier;
  chip: LeadChip | null;
  /** Secondary chip for a scheduled future callback. Rendered alongside the
   * primary chip so the admin sees both the state and the next committed
   * action at once. Null when no callback is scheduled, when the callback is
   * overdue (which becomes the primary red chip), or for NEW/LOST/CONVERTED
   * leads where callbacks don't apply. */
  callbackChip: LeadChip | null;
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
 * Derive urgency tier + row chips for a lead. Pure function — single source of
 * truth for the table's visual prioritisation. LOST and CONVERTED return idle.
 *
 * Returns up to two chips: a primary (state — overdue / ready / half-qualified
 * / etc.) and a secondary callback chip when a future callback is scheduled.
 * The dual-pill model means a scheduled callback never gets eclipsed by an
 * amber drift signal — admin always sees the next committed action.
 *
 * Primary precedence: red > green > amber > idle. The secondary callback
 * pairs with anything except the overdue-callback red (mutually exclusive
 * with a future callback by data model).
 */
export function getUrgencyInfo(lead: UrgencyInput): UrgencyInfo {
  // Terminal states — no chips.
  if (lead.status === "LOST" || lead.status === "CONVERTED") {
    return { tier: "idle", chip: null, callbackChip: null };
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
        callbackChip: null,
      };
    }
    return {
      tier: "blue",
      chip: { kind: "new-lead", label: "New" },
      callbackChip: null,
    };
  }

  // ─── CONTACTED ───────────────────────────────────────────────────────────

  // Secondary chip: future callback. Computed once, attached to every CONTACTED
  // result below except the overdue-callback branch (which is mutually
  // exclusive — nextCallbackAt can't be both past and future).
  let callbackChip: LeadChip | null = null;
  if (lead.nextCallbackAt !== null) {
    const cb = new Date(lead.nextCallbackAt).getTime();
    if (cb >= now) {
      callbackChip = {
        kind: "callback-scheduled",
        label: `Callback · ${fmtTashkentShort(lead.nextCallbackAt)}`,
      };
    }
  }

  // Red: overdue callback (no secondary — by definition, no future callback)
  if (lead.nextCallbackAt !== null) {
    const cb = new Date(lead.nextCallbackAt).getTime();
    if (cb < now) {
      return {
        tier: "red",
        chip: {
          kind: "callback-overdue",
          label: `Callback · ${fmtTashkentTime(lead.nextCallbackAt)}`,
        },
        callbackChip: null,
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
        callbackChip,
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
    lessonPreference: lead.lessonPreference,
    preferredLanguage: lead.preferredLanguage,
    dateOfBirth: lead.dateOfBirth,
    testScore: lead.testScore,
  });
  if (gate.ready) {
    return {
      tier: "green",
      chip: { kind: "ready", label: "Ready to convert" },
      callbackChip,
    };
  }

  // Amber: CONTACTED for >3 days with no progress
  const ageDays = (now - new Date(lead.updatedAt).getTime()) / 86400000;
  if (ageDays > STALE_CONTACTED_DAYS) {
    const days = Math.floor(ageDays);
    return {
      tier: "amber",
      chip: { kind: "stale", label: `Stale ${days}d` },
      callbackChip,
    };
  }

  // Amber: half-qualified — at least one admin-captured gate field, but gate
  // not satisfied. Surfaces leads mid-conversation so admin doesn't lose them.
  //
  // `lessonPreference` and `preferredLanguage` are excluded: those can arrive
  // pre-filled from the intake form, and a lead that has only intake data
  // shouldn't be flagged as "half-qualified" — the admin hasn't done anything
  // yet. The remaining fields can only be set via admin action (the prefs
  // dialog writes days/timeslots/DOB together; testScore comes from recording
  // a placement test result), so any of these being set is a reliable signal
  // that the admin has started qualifying this lead.
  const adminTouched =
    lead.preferredDays.length > 0 ||
    !!lead.preferredDaysAny ||
    lead.preferredTimeSlots.length > 0 ||
    !!lead.preferredTimeSlotsAny ||
    !!lead.dateOfBirth ||
    lead.testScore !== null;
  if (adminTouched && gate.missing.length > 0) {
    return {
      tier: "amber",
      chip: { kind: "half-qualified", label: "Half-qualified" },
      callbackChip,
    };
  }

  // No primary signal — the secondary callback (if any) stands alone.
  return { tier: "idle", chip: null, callbackChip };
}
