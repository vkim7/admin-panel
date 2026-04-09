# Zoom Integration Plan for English Learning Center

## Overview

Integrate Zoom programmatically with our admin panel to automate meeting creation, link sharing, and recording management for online English classes.

## Zoom Plan

**Zoom Workplace Pro** — $14.16/user/month (excl. VAT), billed annually.

- 1–99 licenses per account (all under one organization)
- 10 GB cloud recording storage per license
- 30-hour meeting duration, 100 participants per meeting
- Cloud recording included (local + cloud)
- Server-to-Server OAuth covers the entire org
- Each licensed teacher can host meetings simultaneously

> **Note:** 10 GB cloud storage per teacher fills up fast. Phase 2 downloads recordings to Cloudflare R2 (free egress) and deletes from Zoom.

## Zoom API Authentication

**Server-to-Server OAuth app** (single-organization use):
- Token exchange: `POST https://zoom.us/oauth/token` with `grant_type=account_credentials`
- Token cached in memory with 60-second refresh buffer
- Implementation: `apps/admin/src/lib/zoom.ts`

**Scopes (configured in Zoom app dashboard):**
- `meeting:write:meeting:admin` — create/update meetings
- `meeting:delete:meeting:admin` — delete meetings
- `meeting:update:meeting:admin` — update meetings
- `meeting:read:meeting:admin` — read meeting details (start_url)
- `recording:read:admin` — read recording files (Phase 2)
- `recording:write:admin` — delete recordings from Zoom cloud (Phase 2)

**Env vars (Vercel + `.env.local`):**
- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`

## Teacher Zoom Accounts

- Teachers are added manually to our Zoom org via the Zoom dashboard
- Their Zoom email is stored in `Teacher.zoomEmail` in our DB
- The `zoomEmail` is used as the `{userId}` in Zoom API calls
- A teacher without `zoomEmail` can still have groups — admin sees a warning, and can add a Zoom meeting later via a button

---

## Phase 1 — Meeting Automation ✅

**Status: Implemented**

### What It Does

- Auto-creates a recurring Zoom meeting when a group is created (if teacher has `zoomEmail`)
- Updates Zoom meeting when group start time changes
- Deletes old + creates new meeting on permanent teacher change
- Deletes Zoom meeting on group merge (source group) and graduation (old group)
- "Create Zoom Meeting" button for groups that missed auto-creation
- "Teacher Link" button copies fresh `start_url` (with ZAK token) to clipboard
- "Student Link" with copy button on group detail page
- Warning on group form when teacher has no Zoom email

### Key Decisions

- **`join_before_host: true`, no waiting room** — students can chat in the room before teacher arrives
- **`auto_recording: "none"`** — changed to `"cloud"` in Phase 2
- **`start_url` fetched on demand** — contains ZAK token that expires ~2 hours, so we never store it. Admin clicks "Teacher Link" → fetches fresh URL → copies to clipboard → sends to teacher via messenger.
- **Substitute teachers use existing group link** — no Zoom API calls for substitutions, they join via the group's `join_url`
- **Best-effort pattern** — Zoom API calls happen AFTER DB transactions. If Zoom fails, the group operation still succeeds; admin sees a missing link and can retry.

### Data Model

```prisma
// On Teacher:
zoomEmail  String?  // Zoom account email under our org

// On Group:
zoomMeetingId  String?  // Zoom recurring meeting ID (for API calls)
zoomJoinUrl    String?  // Stable join URL for students
```

### Meeting Settings

```json
{
  "type": 8,
  "timezone": "Asia/Tashkent",
  "recurrence": { "type": 2, "repeat_interval": 1, "weekly_days": "...", "end_date_time": "..." },
  "settings": {
    "join_before_host": true,
    "waiting_room": false,
    "auto_recording": "cloud"
  }
}
```

Day mapping: ISO (1=Mon…7=Sun) → Zoom (1=Sun…7=Sat): `(isoDay % 7) + 1`

### Files

| File | Role |
|------|------|
| `apps/admin/src/lib/zoom.ts` | Core Zoom API service — token management, CRUD, `getZoomStartUrl()` |
| `apps/admin/src/lib/actions/groups.ts` | `createGroup`, `updateGroup`, `createGroupZoomMeeting`, `getZoomHostUrl` |
| `apps/admin/src/lib/helpers/execute-change-teacher.ts` | Delete old meeting + create new on teacher change |
| `apps/admin/src/lib/helpers/execute-merge.ts` | Delete source group meeting on merge |
| `apps/admin/src/lib/actions/group-graduation.ts` | Delete old + create new meeting on graduation |
| `apps/admin/src/components/groups/join-as-host-button.tsx` | "Teacher Link" — fetches `start_url`, copies to clipboard |
| `apps/admin/src/components/groups/create-zoom-meeting-button.tsx` | Manual Zoom meeting creation button |
| `apps/admin/src/components/copy-zoom-button.tsx` | Copy student `join_url` to clipboard |
| `apps/admin/src/components/groups/group-form.tsx` | Warning when teacher has no `zoomEmail` |

---

## Phase 2 — Recording Management

**Status: In progress**

### Architecture

```
Zoom (recording ready, a few minutes after class ends)
  │
  ▼
POST /api/webhooks/zoom  (Vercel)
  - Validates webhook signature via HMAC (CRC)
  - Handles endpoint.url_validation challenge requests
  - On recording.completed: matches meeting → Group → Lesson
  - Creates Recording rows (status: PENDING)
  - Sends download jobs to Cloudflare Worker
  │
  ▼
Cloudflare Worker  (workers/recording-downloader/)
  - Receives: zoomDownloadUrl, r2Key, recordingId, callbackUrl
  - Streams Zoom download → R2 put (no memory buffering)
  - Calls back to Vercel on completion/failure
  │
  ▼
POST /api/webhooks/recording-callback  (Vercel)
  - Validates shared secret
  - Updates Recording.status → COMPLETED or FAILED
  - On COMPLETED: deletes recording from Zoom cloud (frees 10GB/teacher limit)
```

### Why Cloudflare Worker (not Vercel function)

Vercel serverless functions have execution timeouts (10s Hobby, 60s Pro). An 80-minute lesson recording can be 200–500 MB — downloading from Zoom and re-uploading to R2 in one function call risks timeout. Cloudflare Workers can stream fetch → R2.put without buffering the whole file in memory, staying within CPU limits.

### Data Model

```prisma
model Recording {
  id              String          @id @default(cuid())
  lessonId        String
  lesson          Lesson          @relation(fields: [lessonId], references: [id])
  fileType        String          // "MP4", "M4A", "CHAT", "TRANSCRIPT", etc.
  recordingType   String          // "shared_screen_with_gallery_view", "audio_only", etc.
  r2Key           String          // Cloudflare R2 object key
  fileSizeBytes   BigInt
  durationSeconds Int?            // for video/audio files
  status          RecordingStatus @default(PENDING)
  zoomFileId      String          // Zoom recording file ID (for deletion API)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([lessonId])
}

enum RecordingStatus {
  PENDING      // webhook received, Worker not yet started
  DOWNLOADING  // Worker picked it up
  COMPLETED    // stored in R2, ready to serve
  FAILED       // download or upload failed
}
```

R2 key structure: `recordings/{groupId}/{lessonId}/{fileType}_{timestamp}.{ext}`

### Webhook — How Zoom sends recording.completed

```json
{
  "event": "recording.completed",
  "payload": {
    "object": {
      "id": 123456789,
      "topic": "GRP-001 - John Smith",
      "start_time": "2026-04-09T10:00:00Z",
      "recording_files": [
        {
          "id": "file-uuid",
          "meeting_id": "123456789",
          "recording_start": "2026-04-09T10:00:00Z",
          "recording_end": "2026-04-09T11:20:00Z",
          "file_type": "MP4",
          "file_size": 314572800,
          "download_url": "https://zoom.us/rec/download/...",
          "recording_type": "shared_screen_with_gallery_view"
        }
      ]
    }
  }
}
```

**Matching logic:** `payload.object.id` → `Group.zoomMeetingId` → find Lesson by group + date from `recording_start`.

**Download auth:** Zoom download URLs require `?access_token={token}` query param. We pass a fresh OAuth token to the Worker.

### CRC (Challenge-Response Check)

Zoom periodically validates webhook endpoints by sending:
```json
{ "event": "endpoint.url_validation", "payload": { "plainToken": "..." } }
```

Response must be:
```json
{
  "plainToken": "...",
  "encryptedToken": HMAC-SHA256(plainToken, ZOOM_WEBHOOK_SECRET_TOKEN)
}
```

This is NOT one-time — Zoom re-validates periodically.

### Cloudflare Worker

Separate deployable in `workers/recording-downloader/`. Deployed via `wrangler deploy`.

- Has R2 bucket binding (same bucket as admin app)
- Receives POST with `{ zoomDownloadUrl, zoomAccessToken, r2Key, recordingId, callbackUrl, callbackSecret }`
- Streams `fetch(zoomDownloadUrl?access_token=...)` response body → `R2.put(r2Key, body)`
- On completion: POST to `callbackUrl` with `{ recordingId, status, fileSizeBytes }`

Auth between Vercel ↔ Worker: shared secret (`RECORDING_CALLBACK_SECRET`) in request headers.

### Admin UI

- Lesson grid: small camera icon on lesson cells that have recordings
- Click opens a popover listing available files (MP4, audio, etc.)
- Each file links to a presigned R2 URL (1-hour expiry) that opens in a new tab
- PENDING recordings show a spinner/clock icon

### Zoom recording deletion

After successful R2 upload, we delete the recording from Zoom cloud via:
`DELETE /v2/meetings/{meetingId}/recordings/{recordingId}`

This is essential — 10 GB per teacher fills up fast with daily 80-minute lessons.

### Files

| File | Role |
|------|------|
| `packages/database/prisma/schema.prisma` | `Recording` model + `RecordingStatus` enum |
| `apps/admin/src/lib/zoom.ts` | `auto_recording: "cloud"`, `deleteZoomRecording()` |
| `apps/admin/src/app/api/webhooks/zoom/route.ts` | **New** — Zoom webhook (CRC + recording.completed) |
| `apps/admin/src/app/api/webhooks/recording-callback/route.ts` | **New** — Worker callback endpoint |
| `apps/admin/src/lib/queries/recordings.ts` | **New** — get recordings for lessons |
| `apps/admin/src/components/lessons/lesson-grid.tsx` | Recording indicator on lesson cells |
| `apps/admin/src/components/lessons/recording-popover.tsx` | **New** — recording list + playback links |
| `workers/recording-downloader/src/index.ts` | **New** — Cloudflare Worker |
| `workers/recording-downloader/wrangler.toml` | **New** — Worker config with R2 binding |

### Env vars

| Var | Where | Source |
|-----|-------|--------|
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Vercel | Zoom app → webhook settings |
| `RECORDING_WORKER_URL` | Vercel | Cloudflare Worker URL after deploy |
| `RECORDING_CALLBACK_SECRET` | Vercel + Worker | Self-generated shared secret |
| R2 bucket binding | Worker (`wrangler.toml`) | Same R2 bucket as admin app |

### Setup Steps

1. Add scopes `recording:read:admin` + `recording:write:admin` in Zoom app dashboard
2. Deploy the app (so webhook endpoint is live)
3. In Zoom app dashboard: add webhook endpoint URL (`https://<domain>/api/webhooks/zoom`)
4. Copy `secret_token` from Zoom webhook settings → `ZOOM_WEBHOOK_SECRET_TOKEN` env var
5. Deploy Cloudflare Worker via `wrangler deploy`
6. Set `RECORDING_WORKER_URL` and `RECORDING_CALLBACK_SECRET` on both Vercel and Worker

---

## Phase 3 — Enhancements (Deferred)

To be discussed after Phase 2 is complete:
- Admin dashboard showing live meeting status
- Attendance tracking via Zoom participant reports (`GET /v2/report/meetings/{meetingId}/participants`)
- Auto-mark absent students based on participant data
- Recording access for teachers (teacher app) and students (Telegram Mini App)
