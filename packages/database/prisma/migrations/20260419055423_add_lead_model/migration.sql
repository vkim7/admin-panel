-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'TRIAL_SCHEDULED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "LessonPreference" AS ENUM ('GROUP', 'PAIR', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "SelfAssessedLevel" AS ENUM ('COMPLETE_BEGINNER', 'KNOW_A_LITTLE', 'CAN_HOLD_CONVERSATION');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "note" TEXT,
    "language" TEXT NOT NULL,
    "lessonPreference" "LessonPreference",
    "selfAssessedLevel" "SelfAssessedLevel",
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
