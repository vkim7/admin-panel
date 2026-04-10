-- Add unique constraint on Group.zoomMeetingId (each Zoom meeting maps to one group)
CREATE UNIQUE INDEX "Group_zoomMeetingId_key" ON "Group"("zoomMeetingId");

-- Add unique constraint on Recording.zoomFileId (idempotency key for webhook retries)
CREATE UNIQUE INDEX "Recording_zoomFileId_key" ON "Recording"("zoomFileId");
