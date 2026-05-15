-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "preferredDaysAny" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredTimeSlotsAny" BOOLEAN NOT NULL DEFAULT false;
