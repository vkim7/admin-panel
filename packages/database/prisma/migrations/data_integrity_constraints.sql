-- DB-level constraints that MUST live in PostgreSQL (not app-level).
-- Only things here: race-condition-sensitive constraints and computed-field triggers.
-- Everything else (CHECK constraints, field validation) is enforced via Zod at the app level.
--
-- This file is NOT embedded in the Prisma init migration (to avoid drift issues
-- with partial indexes and triggers that Prisma doesn't track).
-- Run this AFTER `prisma migrate deploy` / `prisma migrate reset`:
--   psql $DATABASE_URL -f prisma/migrations/data_integrity_constraints.sql
--
-- IMPORTANT: The auto-computed ID triggers (crmCode, publicId) must be applied
-- BEFORE seeding — the seed relies on explicit values being preserved by the
-- trigger's "skip if non-empty" logic.

-- ─── Partial Unique Index ──────────────────────────────────────────────────

-- A student can only have one active membership per group at a time.
-- (leaveDate IS NULL = currently active)
-- This MUST be DB-level — concurrent requests could both pass an app-level
-- check and insert duplicate active memberships.
CREATE UNIQUE INDEX IF NOT EXISTS active_membership_unique
  ON "GroupMembership" ("studentId", "groupId")
  WHERE "leaveDate" IS NULL;

-- ─── Auto-computed ID Triggers ─────────────────────────────────────────────
-- These triggers compute human-readable IDs from autoincrement sequence numbers.
-- They fire BEFORE INSERT, after PostgreSQL resolves DEFAULT values (including
-- nextval for autoincrement columns), so NEW.sequenceNumber is available.
--
-- These MUST be DB-level — computing from sequenceNumber in a BEFORE INSERT
-- trigger is the only race-condition-free way to derive these IDs.
--
-- If a non-empty value is provided explicitly (e.g., in seed data), the trigger
-- skips computation and preserves the explicit value.

-- Student.crmCode: plain sequence number as string
-- e.g., sequenceNumber 1 → "1", sequenceNumber 42 → "42"
CREATE OR REPLACE FUNCTION set_student_crm_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."crmCode" = '' OR NEW."crmCode" IS NULL THEN
    NEW."crmCode" = NEW."sequenceNumber"::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_crm_code_trigger ON "Student";
CREATE TRIGGER student_crm_code_trigger
  BEFORE INSERT ON "Student"
  FOR EACH ROW
  EXECUTE FUNCTION set_student_crm_code();

-- Group.publicId: type prefix + sequenceNumber (global numbering)
-- GROUP → "GR-1", "GR-2", etc. INDIVIDUAL → "IND-3", "IND-7", etc.
-- Numbers are globally sequential across both types.
CREATE OR REPLACE FUNCTION set_group_public_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."publicId" = '' OR NEW."publicId" IS NULL THEN
    IF NEW."type" = 'GROUP' THEN
      NEW."publicId" = 'GR-' || NEW."sequenceNumber";
    ELSE
      NEW."publicId" = 'IND-' || NEW."sequenceNumber";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS group_public_id_trigger ON "Group";
CREATE TRIGGER group_public_id_trigger
  BEFORE INSERT ON "Group"
  FOR EACH ROW
  EXECUTE FUNCTION set_group_public_id();

-- ─── Current Group Teacher Uniqueness ────────────────────────────────────
-- A group can only have one current teacher at a time.
-- (endDate IS NULL = current teacher assignment)
-- Same race-condition rationale as active_membership_unique above.
CREATE UNIQUE INDEX IF NOT EXISTS current_group_teacher_unique
  ON "GroupTeacherHistory" ("groupId")
  WHERE "endDate" IS NULL;
