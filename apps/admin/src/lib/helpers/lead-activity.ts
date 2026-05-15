import type { PrismaClient, LeadActivityType, LeadStatus, Level, LeadLostReason } from "@eng/database";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// Typed payloads per activity type. The DB column is Json? — these types are the
// contract enforced at the TS layer (Prisma can't discriminate JSON shape).
//
// NOTE: NOTE_UPDATED + CONTACTED_VIA_PHONE/TELEGRAM/WHATSAPP enum values still
// exist in Prisma for forward-compat, but are intentionally omitted here — no
// new activities of those types should be emitted. The feed formatter handles
// historical rows defensively.
export type LeadActivityMetadata =
  | { type: "STATUS_CHANGE"; from: LeadStatus; to: LeadStatus }
  | { type: "CALLBACK_SET"; at: string /* ISO */ }
  | { type: "CALLBACK_DONE"; scheduledFor: string /* ISO */ }
  | { type: "TEST_SENT"; level: Level }
  | { type: "TEST_SCORED"; score: number; level: Level }
  | { type: "SCHEDULE_SET"; days: number[]; timeSlots: string[] }
  | { type: "LOST"; reason: LeadLostReason; otherText?: string }
  | { type: "CONVERTED"; studentId: string };

/**
 * Append a LeadActivity entry inside the caller's transaction. This is the single
 * write chokepoint for activity log entries — never insert directly elsewhere.
 *
 * Pass the transaction client so the activity is rolled back if the surrounding
 * mutation fails. Auto-transition logic should also call this in the same tx.
 */
export async function recordLeadActivity(
  tx: TxClient,
  leadId: string,
  actorAdminId: string | null,
  payload: LeadActivityMetadata,
) {
  const { type, ...rest } = payload;
  const metadata = Object.keys(rest).length > 0 ? rest : undefined;

  await tx.leadActivity.create({
    data: {
      leadId,
      type: type as LeadActivityType,
      metadata: metadata as never, // Prisma typing accepts JsonValue
      actorAdminId,
    },
  });
}

/**
 * NEW → CONTACTED auto-transition. Call inside a transaction BEFORE any mutation
 * that counts as "touching" the lead (callback set, test sent, contact channel
 * opened, note updated, etc.).
 *
 * Returns whether a transition was performed, so the caller can avoid double-
 * recording activities.
 */
export async function autoTransitionToContacted(
  tx: TxClient,
  leadId: string,
  actorAdminId: string | null,
): Promise<boolean> {
  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    select: { status: true },
  });
  if (!lead || lead.status !== "NEW") return false;

  await tx.lead.update({
    where: { id: leadId },
    data: { status: "CONTACTED" },
  });
  await recordLeadActivity(tx, leadId, actorAdminId, {
    type: "STATUS_CHANGE",
    from: "NEW",
    to: "CONTACTED",
  });
  return true;
}
