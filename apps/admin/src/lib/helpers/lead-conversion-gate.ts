import type {
  LessonPreference,
  PreferredLanguage,
  SelfAssessedLevel,
} from "@eng/database";

export type ConversionGateInput = {
  selfAssessedLevel: SelfAssessedLevel | null;
  preferredDays: number[];
  preferredDaysAny?: boolean;
  preferredTimeSlots: string[];
  preferredTimeSlotsAny?: boolean;
  lessonPreference?: LessonPreference | null;
  preferredLanguage?: PreferredLanguage | null;
  dateOfBirth?: Date | null;
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
 * Required for all leads:
 *   - preferredDays (specific value or "Any" flag)
 *   - preferredTimeSlots (specific value or "Any" flag)
 *   - lessonPreference
 *   - preferredLanguage
 *   - selfAssessedLevel (admin captures during qualifying call)
 *   - dateOfBirth
 *
 * Additionally for CONTINUING leads:
 *   - testScore recorded
 *
 * Beginners skip the test. Leads with a still-null level are flagged as
 * "missing: level" — that's expected for newly verified leads (the landing
 * form only collects name + phone), and is captured later via the lead
 * preferences dialog.
 *
 * Advisory only — server-side enforcement was removed. Drives the row urgency
 * chip ("Ready to convert") and the drawer's amber missing-details hint.
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
  if (!lead.lessonPreference) missing.push("lesson type");
  if (!lead.preferredLanguage) missing.push("preferred language");
  if (!lead.selfAssessedLevel) missing.push("level");
  if (!lead.dateOfBirth) missing.push("date of birth");

  if (lead.selfAssessedLevel === "CONTINUING" && lead.testScore === null) {
    missing.push("test score");
  }

  return { ready: missing.length === 0, missing };
}
