-- AlterTable: replace preferredStartTime (nullable String) with preferredTimeSlots (String array)
ALTER TABLE "Student" ADD COLUMN "preferredTimeSlots" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "Student" SET "preferredTimeSlots" = ARRAY["preferredStartTime"] WHERE "preferredStartTime" IS NOT NULL;
ALTER TABLE "Student" DROP COLUMN "preferredStartTime";
ALTER TABLE "Student" ALTER COLUMN "preferredTimeSlots" DROP DEFAULT;
