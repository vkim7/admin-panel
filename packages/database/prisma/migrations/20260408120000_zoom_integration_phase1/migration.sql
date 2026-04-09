-- AlterTable: Replace zoomLink with zoomMeetingId + zoomJoinUrl on Group
ALTER TABLE "Group" ADD COLUMN "zoomJoinUrl" TEXT;
ALTER TABLE "Group" ADD COLUMN "zoomMeetingId" TEXT;

-- Migrate existing zoomLink data to zoomJoinUrl
UPDATE "Group" SET "zoomJoinUrl" = "zoomLink" WHERE "zoomLink" IS NOT NULL;

-- Drop old column
ALTER TABLE "Group" DROP COLUMN "zoomLink";

-- AlterTable: Add zoomEmail to Teacher
ALTER TABLE "Teacher" ADD COLUMN "zoomEmail" TEXT;
