-- Simplify Lead enums: remove PAIR from LessonPreference, replace
-- KNOW_A_LITTLE/CAN_HOLD_CONVERSATION with CONTINUING in SelfAssessedLevel.

-- 1. LessonPreference: remove PAIR
-- Convert any existing PAIR rows to NULL (no preference)
UPDATE "Lead" SET "lessonPreference" = NULL WHERE "lessonPreference" = 'PAIR';

-- Recreate the enum without PAIR
ALTER TYPE "LessonPreference" RENAME TO "LessonPreference_old";
CREATE TYPE "LessonPreference" AS ENUM ('GROUP', 'INDIVIDUAL');
ALTER TABLE "Lead"
  ALTER COLUMN "lessonPreference" TYPE "LessonPreference"
  USING ("lessonPreference"::text::"LessonPreference");
DROP TYPE "LessonPreference_old";

-- 2. SelfAssessedLevel: replace KNOW_A_LITTLE and CAN_HOLD_CONVERSATION with CONTINUING.
-- Rename-and-recreate (no ALTER TYPE ADD VALUE — Postgres requires the new value to
-- be committed before it can be used, which fails when the migration runs inside a
-- transaction such as Prisma's shadow-DB validation). The CASE in the USING clause
-- maps both legacy values to CONTINUING in a single pass.
ALTER TYPE "SelfAssessedLevel" RENAME TO "SelfAssessedLevel_old";
CREATE TYPE "SelfAssessedLevel" AS ENUM ('COMPLETE_BEGINNER', 'CONTINUING');
ALTER TABLE "Lead"
  ALTER COLUMN "selfAssessedLevel" TYPE "SelfAssessedLevel"
  USING (
    CASE
      WHEN "selfAssessedLevel"::text IN ('KNOW_A_LITTLE', 'CAN_HOLD_CONVERSATION') THEN 'CONTINUING'::"SelfAssessedLevel"
      WHEN "selfAssessedLevel"::text = 'COMPLETE_BEGINNER' THEN 'COMPLETE_BEGINNER'::"SelfAssessedLevel"
      ELSE NULL
    END
  );
DROP TYPE "SelfAssessedLevel_old";
