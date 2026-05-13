-- Remove TRIAL_SCHEDULED from LeadStatus. Trial scheduling now lives on the
-- student side (a lead is converted first, then a trial is scheduled on the
-- resulting Student record), so the lead-side status is no longer used.

-- Remap existing rows before altering the enum — Postgres can't cast a value
-- that no longer exists in the target enum.
UPDATE "Lead" SET "status" = 'CONTACTED' WHERE "status" = 'TRIAL_SCHEDULED';

-- Rename-and-recreate the enum (same pattern as 20260419180000_simplify_lead_enums).
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'LOST');
ALTER TABLE "Lead"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "LeadStatus"
  USING ("status"::text::"LeadStatus"),
  ALTER COLUMN "status" SET DEFAULT 'NEW';
DROP TYPE "LeadStatus_old";
