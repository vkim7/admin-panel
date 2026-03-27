/*
  Warnings:

  - You are about to drop the column `cancelledById` on the `ScheduledAction` table. All the data in the column will be lost.
  - You are about to drop the column `destinationGroupId` on the `ScheduledAction` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ScheduledAction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ScheduledAction" DROP CONSTRAINT "ScheduledAction_cancelledById_fkey";

-- DropForeignKey
ALTER TABLE "ScheduledAction" DROP CONSTRAINT "ScheduledAction_destinationGroupId_fkey";

-- AlterTable
ALTER TABLE "ScheduledAction" DROP COLUMN "cancelledById",
DROP COLUMN "destinationGroupId",
DROP COLUMN "updatedAt",
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "destGroupId" TEXT,
ALTER COLUMN "payload" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "ScheduledAction" ADD CONSTRAINT "ScheduledAction_destGroupId_fkey" FOREIGN KEY ("destGroupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
