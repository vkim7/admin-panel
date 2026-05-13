-- Add EITHER to LessonPreference enum, add Student.preferredLessonType
-- (backfilled to EITHER for existing rows), and add unique nullable Student.leadId
-- linking back to the originating Lead on conversion.

-- 1. Recreate LessonPreference enum with EITHER
-- Mirrors the rename-and-recreate pattern from 20260419180000_simplify_lead_enums.
ALTER TYPE "LessonPreference" RENAME TO "LessonPreference_old";
CREATE TYPE "LessonPreference" AS ENUM ('GROUP', 'INDIVIDUAL', 'EITHER');
ALTER TABLE "Lead"
  ALTER COLUMN "lessonPreference" TYPE "LessonPreference"
  USING ("lessonPreference"::text::"LessonPreference");
DROP TYPE "LessonPreference_old";

-- 2. Add Student.preferredLessonType.
-- Use a temporary DEFAULT 'EITHER' to backfill all existing rows in a single
-- statement, then drop the default so the application is forced to supply it
-- explicitly going forward (matches the schema.prisma definition with no @default).
ALTER TABLE "Student" ADD COLUMN "preferredLessonType" "LessonPreference" NOT NULL DEFAULT 'EITHER';
ALTER TABLE "Student" ALTER COLUMN "preferredLessonType" DROP DEFAULT;

-- 3. Add Student.leadId (nullable, unique, FK → Lead with SET NULL on delete).
-- Multiple NULLs are allowed by the unique index (Postgres treats NULLs as distinct).
ALTER TABLE "Student" ADD COLUMN "leadId" TEXT;
CREATE UNIQUE INDEX "Student_leadId_key" ON "Student"("leadId");
ALTER TABLE "Student" ADD CONSTRAINT "Student_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
