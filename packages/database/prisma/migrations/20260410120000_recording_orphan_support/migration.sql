-- AlterTable: add groupId, recordingDate, make lessonId nullable
ALTER TABLE "Recording" ADD COLUMN     "groupId" TEXT NOT NULL,
ADD COLUMN     "recordingDate" DATE NOT NULL,
ALTER COLUMN "lessonId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Recording_groupId_idx" ON "Recording"("groupId");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
