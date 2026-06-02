-- Consolidates duplicate Lead rows (same phone) into a single canonical Lead
-- per phone, in preparation for the @unique constraint added in the next
-- migration. Audit (2026-06-02) showed 23 phones with 2-3 duplicates each,
-- mostly LOST/LOST form-resubmits, plus 3 cases involving a CONVERTED row.
--
-- Strategy — for each phone with >1 row:
--   1. Pick a winner by status priority (CONVERTED > QUALIFIED > CONTACTED >
--      NEW > LOST), then earliest createdAt as tiebreaker. This guarantees
--      CONVERTED leads are never discarded (their Student FK would block it
--      anyway).
--   2. Reassign FKs from losers to the winner so the timeline survives the
--      merge: LeadActivity, SmsHistory.
--   3. Delete the losers.
--
-- Wrapped in a single transaction (Prisma runs each migration.sql in a txn
-- by default), so a partial failure rolls back cleanly. Idempotent on a
-- deduped table — re-running this on already-unique data is a no-op.

WITH ranked AS (
  SELECT
    id,
    phone,
    ROW_NUMBER() OVER (
      PARTITION BY phone
      ORDER BY
        CASE status
          WHEN 'CONVERTED' THEN 1
          WHEN 'QUALIFIED' THEN 2
          WHEN 'CONTACTED' THEN 3
          WHEN 'NEW'       THEN 4
          WHEN 'LOST'      THEN 5
          ELSE 6
        END,
        "createdAt" ASC
    ) AS rn
  FROM "Lead"
),
winners AS (
  SELECT id, phone FROM ranked WHERE rn = 1
),
losers AS (
  SELECT r.id AS loser_id, w.id AS winner_id
  FROM ranked r
  JOIN winners w ON w.phone = r.phone
  WHERE r.rn > 1
),
-- Reassign activity history from losers to their winner. Done before the
-- delete so the FK from LeadActivity.leadId (onDelete: Restrict implied)
-- can never block the cleanup.
reassigned_activities AS (
  UPDATE "LeadActivity" la
  SET "leadId" = l.winner_id
  FROM losers l
  WHERE la."leadId" = l.loser_id
  RETURNING la.id
),
-- Reassign SmsHistory rows similarly. The SmsHistory CHECK constraint
-- (studentId XOR leadId) is preserved — we only change which leadId.
reassigned_sms AS (
  UPDATE "SmsHistory" sh
  SET "leadId" = l.winner_id
  FROM losers l
  WHERE sh."leadId" = l.loser_id
  RETURNING sh.id
)
DELETE FROM "Lead"
WHERE id IN (SELECT loser_id FROM losers);
