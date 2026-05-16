-- CreateEnum
CREATE TYPE "GroupClosedReason" AS ENUM ('STUDENTS_LEFT', 'LOW_ENROLLMENT', 'ADMIN_ERROR', 'OTHER');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "closedReason" "GroupClosedReason";

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
