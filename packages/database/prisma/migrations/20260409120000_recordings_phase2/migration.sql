-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "recordingType" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "durationSeconds" INTEGER,
    "status" "RecordingStatus" NOT NULL DEFAULT 'PENDING',
    "zoomFileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recording_lessonId_idx" ON "Recording"("lessonId");

-- CreateIndex
CREATE INDEX "Recording_status_idx" ON "Recording"("status");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
