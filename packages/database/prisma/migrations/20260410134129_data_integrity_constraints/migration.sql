-- Custom DB-level constraints: partial unique indexes and auto-ID triggers.
-- These were previously applied via data_integrity_constraints.sql and are now
-- tracked as a proper migration to eliminate Prisma drift detection issues.

-- ─── Partial Unique Index ──────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS active_membership_unique
  ON "GroupMembership" ("studentId", "groupId")
  WHERE "leaveDate" IS NULL;

-- ─── Auto-computed ID Triggers ─────────────────────────────────────────────

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

CREATE UNIQUE INDEX IF NOT EXISTS current_group_teacher_unique
  ON "GroupTeacherHistory" ("groupId")
  WHERE "endDate" IS NULL;
