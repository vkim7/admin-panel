import type { SelfAssessedLevel } from "@eng/database";

export type ConversionGateInput = {
  selfAssessedLevel: SelfAssessedLevel | null;
  preferredDays: number[];
  preferredDaysAny?: boolean;
  preferredTimeSlots: string[];
  preferredTimeSlotsAny?: boolean;
  testScore: number | null;
};

export type ConversionGateResult = {
  ready: boolean;
  /** Human-readable list of missing items, suitable for tooltip / button-hint. */
  missing: string[];
};

/**
 * Determines whether a lead is ready to convert to a student.
 *
 * Rules (per product spec):
 * - Beginner (COMPLETE_BEGINNER): preferred days + preferred time captured.
 *   "Any" counts as captured (admin explicitly marked the field flexible).
 * - Continuing or unknown: above + placement test score required.
 *
 * Used both for drawer display (Convert button hint) and for the row urgency
 * tier (blue "Ready to convert"). The server-side enforcement was removed —
 * gate is advisory only.
 */
export function evaluateConversionGate(
  lead: ConversionGateInput,
): ConversionGateResult {
  const missing: string[] = [];

  const daysCaptured = lead.preferredDays.length > 0 || !!lead.preferredDaysAny;
  const timeCaptured =
    lead.preferredTimeSlots.length > 0 || !!lead.preferredTimeSlotsAny;

  if (!daysCaptured) missing.push("preferred days");
  if (!timeCaptured) missing.push("preferred time");

  const needsTest = lead.selfAssessedLevel !== "COMPLETE_BEGINNER";
  if (needsTest && lead.testScore === null) {
    missing.push("test score");
  }

  return { ready: missing.length === 0, missing };
}
