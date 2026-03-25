-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "uncertainReasonId" TEXT;

-- CreateTable
CREATE TABLE "UncertainReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UncertainReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UncertainHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "uncertainReasonId" TEXT NOT NULL,
    "otherReason" TEXT,
    "flaggedBy" "UncertainFlagSource" NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flaggedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "UncertainHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UncertainReason_name_key" ON "UncertainReason"("name");

-- CreateIndex
CREATE INDEX "UncertainHistory_studentId_idx" ON "UncertainHistory"("studentId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_uncertainReasonId_fkey" FOREIGN KEY ("uncertainReasonId") REFERENCES "UncertainReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UncertainHistory" ADD CONSTRAINT "UncertainHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UncertainHistory" ADD CONSTRAINT "UncertainHistory_uncertainReasonId_fkey" FOREIGN KEY ("uncertainReasonId") REFERENCES "UncertainReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UncertainHistory" ADD CONSTRAINT "UncertainHistory_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UncertainHistory" ADD CONSTRAINT "UncertainHistory_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
