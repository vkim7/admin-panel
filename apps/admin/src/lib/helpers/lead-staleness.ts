import type { LeadStatus } from "@eng/database";

export const STALE_NEW_HOURS = 24;
export const STALE_CONTACTED_DAYS = 3;

type StaleInput = {
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type StaleInfo = {
  color: "red" | "amber";
  reason: string;
};

export function getStaleInfo(lead: StaleInput): StaleInfo | null {
  const now = Date.now();

  if (lead.status === "NEW") {
    const ageHours = (now - new Date(lead.createdAt).getTime()) / 3600000;
    if (ageHours > STALE_NEW_HOURS) {
      const days = Math.floor(ageHours / 24);
      return { color: "red", reason: `Uncalled — new for ${days} day${days !== 1 ? "s" : ""}` };
    }
  }

  if (lead.status === "CONTACTED") {
    // updatedAt covers status changes and admin note edits — any staff touch resets the clock.
    const ageDays = (now - new Date(lead.updatedAt).getTime()) / 86400000;
    if (ageDays > STALE_CONTACTED_DAYS) {
      const days = Math.floor(ageDays);
      return {
        color: "amber",
        reason: `No progress — last touched ${days} day${days !== 1 ? "s" : ""} ago`,
      };
    }
  }

  return null;
}
