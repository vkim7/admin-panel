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

-- 2. SelfAssessedLevel: replace KNOW_A_LITTLE and CAN_HOLD_CONVERSATION with CONTINUING
-- Add CONTINUING to the existing enum first
ALTER TYPE "SelfAssessedLevel" ADD VALUE IF NOT EXISTS 'CONTINUING';

-- Migrate existing rows
UPDATE "Lead" SET "selfAssessedLevel" = 'CONTINUING' WHERE "selfAssessedLevel" IN ('KNOW_A_LITTLE', 'CAN_HOLD_CONVERSATION');

-- Recreate the enum with only the two values
ALTER TYPE "SelfAssessedLevel" RENAME TO "SelfAssessedLevel_old";
CREATE TYPE "SelfAssessedLevel" AS ENUM ('COMPLETE_BEGINNER', 'CONTINUING');
ALTER TABLE "Lead"
  ALTER COLUMN "selfAssessedLevel" TYPE "SelfAssessedLevel"
  USING ("selfAssessedLevel"::text::"SelfAssessedLevel");
DROP TYPE "SelfAssessedLevel_old";
