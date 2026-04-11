-- AlterEnum
ALTER TYPE "AdjustmentType" ADD VALUE 'EXCUSED_ABSENCE';

-- DropIndex
DROP INDEX "active_membership_unique";

-- DropIndex
DROP INDEX "current_group_teacher_unique";

-- CreateTable
CREATE TABLE "ExcusedAbsenceReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcusedAbsenceReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcusedAbsence" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupMembershipId" TEXT NOT NULL,
    "reasonId" TEXT NOT NULL,
    "otherReason" TEXT,
    "note" TEXT,
    "documentFileName" TEXT,
    "documentFileKey" TEXT,
    "documentFileSize" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcusedAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExcusedAbsenceReason_name_key" ON "ExcusedAbsenceReason"("name");

-- CreateIndex
CREATE INDEX "ExcusedAbsence_studentId_idx" ON "ExcusedAbsence"("studentId");

-- CreateIndex
CREATE INDEX "ExcusedAbsence_groupMembershipId_idx" ON "ExcusedAbsence"("groupMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "ExcusedAbsence_lessonId_studentId_key" ON "ExcusedAbsence"("lessonId", "studentId");

-- AddForeignKey
ALTER TABLE "ExcusedAbsence" ADD CONSTRAINT "ExcusedAbsence_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcusedAbsence" ADD CONSTRAINT "ExcusedAbsence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcusedAbsence" ADD CONSTRAINT "ExcusedAbsence_groupMembershipId_fkey" FOREIGN KEY ("groupMembershipId") REFERENCES "GroupMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcusedAbsence" ADD CONSTRAINT "ExcusedAbsence_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "ExcusedAbsenceReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcusedAbsence" ADD CONSTRAINT "ExcusedAbsence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
