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
- **`auto_recording: "cloud"`** — recordings start automatically when meeting starts, processed by Phase 2 pipeline
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

## Phase 2 — Recording Management ✅

**Status: Implemented**

### Architecture

```
Zoom (recording ready, a few minutes after class ends)
  │
  ▼
POST /api/webhooks/zoom  (Vercel)
  - Handles CRC challenge-response (Zoom periodic re-validation)
  - On recording.completed: extracts download_token (JWT, 24h TTL) from payload root
  - Matches meeting → Group via zoomMeetingId
  - Matches recording date → Lesson (nullable — orphan if no lesson that day)
  - Creates Recording rows (status: PENDING)
  - Dispatches download jobs to Cloudflare Worker
  │
  ▼
Cloudflare Worker  (workers/recording-downloader/)
  - Downloads from Zoom using ?access_token={download_token} query param
  - Streams directly to R2 (no memory buffering — handles 500MB+ files)
  - Calls back to Vercel on completion/failure
  │
  ▼
POST /api/webhooks/recording-callback  (Vercel)
  - Updates Recording.status → COMPLETED or FAILED
  - On COMPLETED: deletes recording from Zoom cloud via S2S OAuth
    (DELETE /meetings/{id}/recordings/{fileId}?action=trash)
  - Frees 10GB/teacher storage limit; trashed files recoverable for 30 days
```

### Why Cloudflare Worker (not Vercel function)

Vercel serverless functions have execution timeouts (10s Hobby, 60s Pro). An 80-minute lesson recording can be 200–500 MB — downloading from Zoom and re-uploading to R2 in one function call risks timeout. Cloudflare Workers have no such limit for streaming I/O, and sit on the same network as R2 (essentially free internal transfer). The Worker streams `fetch()` response body directly to `R2.put()` without buffering in memory.

**Cost:** 100k requests/day free, then $0.50/million. Expected usage ~100 requests/day (25 teachers × 4 files/lesson) = well within free tier.

### Critical: Download Token vs S2S OAuth Token

Zoom has **two different token types** — using the wrong one causes 401 errors:

| Token | Use For | Lifetime | How to Get |
|-------|---------|----------|------------|
| `download_token` (JWT) | Downloading recording files from webhook `download_url`s | 24 hours | Root of `recording.completed` webhook payload (`body.download_token`) |
| S2S OAuth `access_token` | All other Zoom API calls (CRUD, deletion) | 1 hour | `POST https://zoom.us/oauth/token` with `account_credentials` grant |

**S2S OAuth tokens do NOT work for webhook download URLs.** This is documented Zoom behavior — the download server rejects them with 401 Forbidden (errorCode 300).

**Download approach:** Pass the `download_token` as a query parameter (`?access_token={token}`) rather than a Bearer header. Zoom's download server issues cross-origin 302 redirects to a CDN, and HTTP clients strip `Authorization` headers on cross-origin redirects. The query parameter survives redirects automatically.

### Orphan Recordings

When a lesson is informally rescheduled (e.g., all students agree to move to a different day), the recording won't match any scheduled lesson. These are stored as **orphan recordings**:

- `lessonId` is `NULL`, `groupId` and `recordingDate` are always set
- R2 key uses `orphan_YYYY-MM-DD` instead of `lessonId` as the folder name
- Visible in the admin panel under the group's orphan recordings section
- Can be manually linked to a lesson in the future (Phase 3)

### Data Model

```prisma
model Recording {
  id              String          @id @default(cuid())
  groupId         String                              // always set
  lessonId        String?                             // null for orphan recordings
  recordingDate   DateTime        @db.Date            // UTC date of recording
  fileType        String          // "MP4", "M4A", "CHAT", "TRANSCRIPT", "TIMELINE"
  recordingType   String          // "shared_screen_with_gallery_view", "audio_only", etc.
  r2Key           String          // Cloudflare R2 object key
  fileSizeBytes   BigInt
  durationSeconds Int?            // for video/audio files
  status          RecordingStatus @default(PENDING)
  zoomFileId      String          // Zoom recording file ID (for deletion API)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  group  Group   @relation(fields: [groupId], references: [id], onDelete: Restrict)
  lesson Lesson? @relation(fields: [lessonId], references: [id], onDelete: Restrict)

  @@index([groupId])
  @@index([lessonId])
  @@index([status])
}

enum RecordingStatus {
  PENDING      // webhook received, Worker not yet started
  DOWNLOADING  // Worker picked it up (reserved for future use)
  COMPLETED    // stored in R2, ready to serve
  FAILED       // download or upload failed
}
```

**R2 key structure:**
- With lesson: `recordings/{groupId}/{lessonId}/{FILE_TYPE}_YYYY-MM-DD.{ext}`
- Orphan: `recordings/{groupId}/orphan_YYYY-MM-DD/{FILE_TYPE}_YYYY-MM-DD.{ext}`

### Webhook Payload

Zoom sends `recording.completed` after cloud recording finishes processing:

```json
{
  "event": "recording.completed",
  "download_token": "eyJhbG...",          // ← JWT at the ROOT level, valid 24h
  "payload": {
    "object": {
      "id": 123456789,                    // numeric meeting ID → Group.zoomMeetingId
      "uuid": "WEz4RT2lSyKx2MD9Z+lYfA==",
      "topic": "GRP-001 - John Smith",
      "recording_files": [
        {
          "id": "file-uuid",
          "file_type": "MP4",
          "file_size": 314572800,
          "download_url": "https://us02web.zoom.us/rec/webhook_download/...",
          "recording_start": "2026-04-09T10:00:00Z",
          "recording_end": "2026-04-09T11:20:00Z",
          "recording_type": "shared_screen_with_gallery_view"
        }
      ]
    }
  }
}
```

**Matching logic:** `payload.object.id` → `Group.zoomMeetingId` → find Lesson by group + UTC date from `recording_start`. If no lesson matches → orphan.

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

This is NOT one-time — Zoom re-validates periodically. Our endpoint must always be ready to handle this.

### Cloudflare Worker

Separate deployable in `workers/recording-downloader/`. Deployed via `npx wrangler deploy` from that directory.

- R2 bucket binding: `admin-panel`
- Deployed URL: `https://recording-downloader.banana-school-admin-panel.workers.dev`
- Receives POST with `{ zoomDownloadUrl, zoomDownloadToken, r2Key, recordingId, callbackUrl, callbackSecret }`
- Downloads via `fetch(zoomDownloadUrl + '?access_token=' + zoomDownloadToken)` — query param survives redirects
- Streams response body directly to `env.BUCKET.put(r2Key, body)` — no memory buffering
- On completion: POST to `callbackUrl` with `{ recordingId, status: "completed", fileSizeBytes }`
- On failure: POST with `{ recordingId, status: "failed", error }`

Auth between Vercel ↔ Worker: shared `RECORDING_CALLBACK_SECRET` as Bearer token in both directions.

### Zoom Recording Deletion

After successful R2 upload, the callback handler deletes each recording file from Zoom cloud:

```
DELETE /v2/meetings/{meetingId}/recordings/{recordingFileId}?action=trash
```

- Uses S2S OAuth token (regular API call, not a download)
- `action=trash` moves to Zoom trash (recoverable for 30 days) rather than permanent delete
- 204 = trashed, 404 = already gone — both treated as success
- Each file is deleted individually as its callback arrives (3 files per meeting = 3 delete calls)

This is essential — 10 GB per teacher fills up in ~2 weeks with daily 80-minute lessons.

### Admin UI

- Lesson grid: blue video icon on lesson cells that have recordings
- Clicking opens a dialog listing available files (type, size, duration)
- "Open" button generates a presigned R2 URL (1-hour expiry) and opens in a new tab
- Orphan recordings shown separately on the group page

### Files

| File | Role |
|------|------|
| `packages/database/prisma/schema.prisma` | `Recording` model + `RecordingStatus` enum |
| `apps/admin/src/lib/zoom.ts` | `auto_recording: "cloud"`, `deleteZoomRecording()`, `getAccessToken()` |
| `apps/admin/src/app/api/webhooks/zoom/route.ts` | Zoom webhook handler (CRC + recording.completed) |
| `apps/admin/src/app/api/webhooks/recording-callback/route.ts` | Worker callback — marks complete, triggers Zoom deletion |
| `apps/admin/src/lib/queries/recordings.ts` | `getRecordingCountsForGroup()`, `getOrphanRecordingsForGroup()` |
| `apps/admin/src/lib/actions/recordings.ts` | `getRecordingUrl()` — presigned R2 URL generation |
| `apps/admin/src/lib/actions/recordings-query.ts` | `getRecordingsForLesson()` — server action for client components |
| `apps/admin/src/components/lessons/recording-list.tsx` | Recording file list with type icons and playback links |
| `apps/admin/src/components/lessons/lesson-grid.tsx` | Recording indicator on lesson cells |
| `apps/admin/src/components/lessons/lesson-detail-dialog.tsx` | Shows recordings inside lesson detail dialog |
| `apps/admin/src/app/(admin)/groups/[id]/page.tsx` | Fetches recording counts, passes to LessonGrid |
| `apps/admin/src/middleware.ts` | Excludes `api/webhooks` from auth middleware |
| `workers/recording-downloader/src/index.ts` | Cloudflare Worker — streams Zoom → R2 |
| `workers/recording-downloader/wrangler.toml` | Worker config with R2 bucket binding |

### Env Vars

| Var | Where | Source |
|-----|-------|--------|
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Vercel | Zoom app → Feature → webhook settings → Secret Token |
| `RECORDING_WORKER_URL` | Vercel | Cloudflare Worker URL after deploy |
| `RECORDING_CALLBACK_SECRET` | Vercel + Worker | Self-generated shared secret (set on Worker via `wrangler secret put`) |
| `NEXT_PUBLIC_APP_URL` | Vercel | Your production domain (no trailing slash!) — used for callback URL |
| R2 bucket binding `BUCKET` | Worker (`wrangler.toml`) | R2 bucket name: `admin-panel` |

### Zoom App Scopes (configured in Zoom Marketplace dashboard)

- `cloud_recording:read:recording:admin` — receive recording webhooks
- `cloud_recording:delete:recording_file:admin` — delete individual recording files

### Setup Steps

1. Add recording scopes in Zoom app dashboard (Marketplace → your S2S app → Scopes)
2. Enable cloud recording on Zoom account (Admin → Account Settings → Recording → Cloud recording ON)
3. Deploy the admin app (so webhook endpoint is live on Vercel)
4. In Zoom app dashboard → Feature → Event Subscriptions: add endpoint URL (`https://<domain>/api/webhooks/zoom`), subscribe to `recording.completed` event type "All recordings have completed"
5. Copy Secret Token from webhook settings → `ZOOM_WEBHOOK_SECRET_TOKEN` env var on Vercel
6. Deploy Cloudflare Worker: `cd workers/recording-downloader && npx wrangler deploy`
7. Set shared secret on Worker: `npx wrangler secret put CALLBACK_SECRET`
8. Set `RECORDING_WORKER_URL` and `RECORDING_CALLBACK_SECRET` on Vercel
9. Ensure `NEXT_PUBLIC_APP_URL` on Vercel has no trailing slash (prevents double-slash in callback URL)

---

## Phase 3 — Enhancements (Deferred)

To be discussed after Phase 2 is complete:
- Admin dashboard showing live meeting status
- Attendance tracking via Zoom participant reports (`GET /v2/report/meetings/{meetingId}/participants`)
- Auto-mark absent students based on participant data
- Recording access for teachers (teacher app) and students (Telegram Mini App)
