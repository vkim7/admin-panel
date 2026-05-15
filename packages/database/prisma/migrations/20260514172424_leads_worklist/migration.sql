-- CreateEnum
CREATE TYPE "LeadLostReason" AS ENUM ('NO_ANSWER', 'WRONG_NUMBER', 'DIDNT_SUBMIT', 'AGE_OUT_OF_RANGE', 'NOT_INTERESTED', 'WANTED_OFFLINE', 'DUPLICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('STATUS_CHANGE', 'CALLBACK_SET', 'CALLBACK_DONE', 'TEST_SENT', 'TEST_SCORED', 'SCHEDULE_SET', 'LOST', 'CONVERTED', 'CONTACTED_VIA_PHONE', 'CONTACTED_VIA_TELEGRAM', 'CONTACTED_VIA_WHATSAPP', 'NOTE_UPDATED');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "lostReason" "LeadLostReason",
ADD COLUMN     "lostReasonOther" TEXT,
ADD COLUMN     "nextCallbackAt" TIMESTAMP(3),
ADD COLUMN     "preferredDays" INTEGER[],
ADD COLUMN     "preferredTimeSlots" TEXT[],
ADD COLUMN     "testLevelSent" "Level",
ADD COLUMN     "testScore" INTEGER,
ADD COLUMN     "testScoredAt" TIMESTAMP(3),
ADD COLUMN     "testSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "metadata" JSONB,
    "actorAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_nextCallbackAt_idx" ON "Lead"("nextCallbackAt");

-- CreateIndex
CREATE INDEX "Lead_status_nextCallbackAt_idx" ON "Lead"("status", "nextCallbackAt");

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
