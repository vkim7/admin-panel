-- AlterTable
ALTER TABLE "GroupMembership" ADD COLUMN "wasTrialOriginally" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupMembership" ADD COLUMN "trialTeacherId" TEXT;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_trialTeacherId_fkey" FOREIGN KEY ("trialTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: mark existing trial memberships
UPDATE "GroupMembership" SET "wasTrialOriginally" = true WHERE "isTrial" = true;

-- Backfill: snapshot trialTeacherId from group's current teacher
UPDATE "GroupMembership" gm
  SET "trialTeacherId" = g."teacherId"
  FROM "Group" g
  WHERE gm."groupId" = g."id" AND gm."isTrial" = true;
