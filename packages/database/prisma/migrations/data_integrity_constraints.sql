-- Auto-computed ID triggers that MUST live in PostgreSQL.
-- These are the only DB-level constraints — everything else is enforced at the app level.
--
-- Safety net for fresh DB setup (when migrations/ is deleted and you start with db push):
--   psql $DATABASE_URL -f prisma/migrations/data_integrity_constraints.sql
--
-- IMPORTANT: Must be applied BEFORE seeding — the seed relies on explicit values
-- being preserved by the trigger's "skip if non-empty" logic.
--
-- Note: Partial unique indexes (active_membership_unique, current_group_teacher_unique)
-- were removed — they caused Prisma migration drift on every `migrate dev`. The same
-- constraints are enforced at the app level in server actions (execute-assign.ts,
-- execute-transfer.ts, execute-merge.ts, execute-change-teacher.ts).

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
