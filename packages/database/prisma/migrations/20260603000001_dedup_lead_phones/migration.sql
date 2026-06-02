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
-- Implementation note — earlier attempts at this migration tried two patterns
-- that don't survive Prisma's migration runner:
--   * A single multi-statement WITH expression: Postgres runs data-modifying
--     CTEs in one snapshot with undefined write order, so the DELETE could
--     race the UPDATEs and trip SmsHistory.leadId's ON DELETE RESTRICT.
--   * A TEMP TABLE shared across statements: Prisma's migration runner
--     evidently doesn't keep TEMP tables alive between statements (likely
--     pool-connection or per-statement session reset), so the UPDATE following
--     the CREATE TEMP TABLE failed with "relation does not exist".
--
-- This version uses three independent statements with the ranking CTE inlined
-- in each. Each statement is self-contained, the ranking is cheap (~30 rows),
-- and Prisma still wraps the whole file in one transaction so it's atomic.

-- 1. Reassign LeadActivity from losers to winners. LeadActivity uses ON DELETE
-- CASCADE so without this step the loser leads' activities would be silently
-- deleted along with them — we explicitly preserve them on the winner row.
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
winners AS (SELECT id, phone FROM ranked WHERE rn = 1),
losers AS (
  SELECT r.id AS loser_id, w.id AS winner_id
  FROM ranked r
  JOIN winners w ON w.phone = r.phone
  WHERE r.rn > 1
)
UPDATE "LeadActivity" la
SET "leadId" = l.winner_id
FROM losers l
WHERE la."leadId" = l.loser_id;

-- 2. Reassign SmsHistory similarly. SmsHistory.leadId uses ON DELETE RESTRICT,
-- so this step is what unblocks the DELETE in step 3.
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
winners AS (SELECT id, phone FROM ranked WHERE rn = 1),
losers AS (
  SELECT r.id AS loser_id, w.id AS winner_id
  FROM ranked r
  JOIN winners w ON w.phone = r.phone
  WHERE r.rn > 1
)
UPDATE "SmsHistory" sh
SET "leadId" = l.winner_id
FROM losers l
WHERE sh."leadId" = l.loser_id;

-- 3. Delete losers. By this point the previous two statements have committed
-- their FK reassignments within the transaction, so no LeadActivity or
-- SmsHistory row still points at a loser.
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
)
DELETE FROM "Lead"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
