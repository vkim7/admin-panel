-- Consolidates duplicate Lead rows (same phone) into a single canonical Lead
-- per phone, in preparation for the @unique constraint added in the next
-- migration. Audit (2026-06-02) showed 23 phones with 2-3 duplicates each,
-- mostly LOST/LOST form-resubmits, plus 3 cases involving a CONVERTED row.
--
-- Strategy — for each phone with >1 row:
--   1. Pick a winner by status priority (CONVERTED > CONTACTED > NEW > LOST),
--      then earliest createdAt as tiebreaker. CONVERTED leads are never
--      discarded (their Student FK would block it anyway).
--   2. Reassign FKs from losers to the winner so the timeline survives the
--      merge: LeadActivity, SmsHistory.
--   3. Delete the losers.
--
-- Implementation note — the previous version used a single multi-statement
-- WITH expression. Postgres runs data-modifying CTEs in *one snapshot* with
-- undefined write order, so the DELETE could execute before the UPDATEs,
-- tripping SmsHistory.leadId's ON DELETE RESTRICT. The version below uses
-- sequential statements: each one fully completes (and its effects are
-- visible to the next) before the following statement runs. The temp table
-- (created with ON COMMIT DROP) is the only state shared between them.
-- Prisma wraps the whole file in a transaction so the temp table is dropped
-- automatically on commit.

CREATE TEMPORARY TABLE _dedup_lead_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    phone,
    ROW_NUMBER() OVER (
      PARTITION BY phone
      ORDER BY
        CASE status
          WHEN 'CONVERTED' THEN 1
          WHEN 'CONTACTED' THEN 2
          WHEN 'NEW'       THEN 3
          WHEN 'LOST'      THEN 4
          ELSE 5
        END,
        "createdAt" ASC
    ) AS rn
  FROM "Lead"
),
winners AS (SELECT id, phone FROM ranked WHERE rn = 1)
SELECT r.id AS loser_id, w.id AS winner_id
FROM ranked r
JOIN winners w ON w.phone = r.phone
WHERE r.rn > 1;

-- Reassign activity history from losers to their winner. LeadActivity uses
-- ON DELETE CASCADE so without this step the loser leads' activities would
-- be silently deleted along with them — we explicitly preserve them.
UPDATE "LeadActivity" la
SET "leadId" = m.winner_id
FROM _dedup_lead_map m
WHERE la."leadId" = m.loser_id;

-- Reassign SmsHistory similarly. The SmsHistory CHECK constraint
-- (studentId XOR leadId) is preserved — we only change which leadId.
-- SmsHistory.leadId uses ON DELETE RESTRICT, so this step is what unblocks
-- the DELETE below.
UPDATE "SmsHistory" sh
SET "leadId" = m.winner_id
FROM _dedup_lead_map m
WHERE sh."leadId" = m.loser_id;

DELETE FROM "Lead"
WHERE id IN (SELECT loser_id FROM _dedup_lead_map);
