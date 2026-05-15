/**
 * Reception worklist urgency — how long a student has been awaiting assignment.
 *
 *   < 3 days   blue  (fresh — informational; "Waiting Xh" or "Just arrived")
 *   ≥ 3 days   amber (aging — admin should action)
 *   ≥ 7 days   red   (overdue — process bottleneck)
 *
 * Threshold rationale: 3 days is a casual wait, 7+ days is a process bottleneck
 * worth flagging. Tweak per ops feedback.
 */

export type ReceptionUrgency = {
  tier: "red" | "amber" | "blue";
  label: string;
};

export const RECEPTION_AMBER_DAYS = 3;
export const RECEPTION_RED_DAYS = 7;

export function getReceptionUrgency(createdAt: Date): ReceptionUrgency {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = ms / 3600_000;
  const days = ms / (24 * 3600_000);

  let label: string;
  if (hours < 1) {
    label = "Just arrived";
  } else if (days < 1) {
    label = `Waiting ${Math.floor(hours)}h`;
  } else {
    label = `Waiting ${Math.floor(days)}d`;
  }

  let tier: ReceptionUrgency["tier"];
  if (days >= RECEPTION_RED_DAYS) tier = "red";
  else if (days >= RECEPTION_AMBER_DAYS) tier = "amber";
  else tier = "blue";

  return { tier, label };
}
