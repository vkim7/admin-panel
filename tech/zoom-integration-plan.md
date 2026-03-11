# Zoom Integration Plan for English Learning Center

## Overview

Integrate Zoom programmatically with our admin panel to automate meeting creation, link sharing, and recording management for online English classes.

## Recommended Zoom Plan

**Zoom Workplace Pro** — $14.16/user/month (excl. VAT), billed annually.

- 1–99 licenses per account (all under one organization)
- 10 GB cloud recording storage per license
- 30-hour meeting duration, 100 participants per meeting
- Cloud recording included (local + cloud)
- Server-to-Server OAuth covers the entire org
- Each licensed teacher can host meetings simultaneously

Only upgrade to Business ($18.33/user/mo) if we need SSO, recording transcriptions, or 300+ participant capacity.

**Cost estimate:** For N teachers, monthly cost = N × $14.16 (+ VAT). E.g., 5 teachers ≈ $70.80/mo, 10 teachers ≈ $141.60/mo.

> **Note:** 10 GB cloud storage per teacher fills up fast with regular recordings. Our plan to download recordings to own storage (S3/MinIO) and delete from Zoom is essential.

## Current Workflow

- Teachers have ~12 classes/month
- Teachers manually share Zoom links with students and management
- Admin needs to monitor lessons (check if started, observe quality)
- Recordings needed for students who miss classes

## Proposed Architecture

### 1. Zoom API Authentication

- Create a **Server-to-Server OAuth app** in the Zoom Marketplace (simplest for single-organization use)
- This gives you a client ID, client secret, and account ID
- Token exchange: `POST https://zoom.us/oauth/token` with `grant_type=account_credentials`
- Scopes needed: `meeting:write:admin`, `meeting:read:admin`, `recording:read:admin`, `recording:write:admin`

### 2. Recurring Meeting Creation

When an admin creates a group in our panel, the backend automatically creates a Zoom recurring meeting.

**API Endpoint:** `POST /v2/users/{teacherZoomUserId}/meetings`

**Payload:**

```json
{
  "topic": "{GroupName} - {TeacherName}",
  "type": 8,
  "start_time": "2025-04-01T10:00:00Z",
  "duration": 60,
  "timezone": "Asia/Tashkent",
  "recurrence": {
    "type": 2,
    "repeat_interval": 1,
    "weekly_days": "2,4",
    "end_times": 12
  },
  "settings": {
    "join_before_host": false,
    "waiting_room": true,
    "meeting_authentication": false,
    "auto_recording": "cloud"
  }
}
```

**Key fields:**

| Field | Description |
|---|---|
| `type: 8` | Recurring meeting with fixed time |
| `recurrence.type: 2` | Weekly recurrence |
| `weekly_days` | 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat |
| `end_times` | Number of occurrences (12 = one month of classes) |
| `auto_recording: "cloud"` | Records every session automatically |

**Response fields to store:**

- `id` — Zoom meeting ID (needed for updates, deletion, fetching recordings)
- `join_url` — the link shared with teachers and students
- `start_url` — host-specific URL (for the teacher)

### 3. Data Model Changes

Add to the **Group** model:

```
zoom_meeting_id: str
zoom_join_url: str
zoom_host_url: str
zoom_created_at: datetime
```

Add a **SessionRecording** model:

```
group_id: FK → Group
session_date: date
recording_storage_url: str  (our S3/MinIO URL)
recording_duration: int
created_at: datetime
```

### 4. Meeting Lifecycle Management

| Event | Action |
|---|---|
| Group created | `POST /v2/users/{userId}/meetings` → store meeting ID and URLs |
| Group schedule changed | `PATCH /v2/meetings/{meetingId}` → update recurrence |
| Group deleted | `DELETE /v2/meetings/{meetingId}` |
| Teacher changed | Delete old meeting, create new one under new teacher's Zoom user |

### 5. Recording Workflow

**Flow:**

```
Class ends
  → Zoom processes recording (takes a few minutes)
  → Zoom sends `recording.completed` webhook to our endpoint
  → Backend matches meeting_id to group
  → Backend downloads MP4 via download_url to our storage (S3/MinIO)
  → Backend deletes recording from Zoom cloud (POST /v2/meetings/{meetingId}/recordings/{recordingId} DELETE)
  → Links recording to the session in our DB
  → Students marked absent see "Watch Recording" in their dashboard
```

**Webhook setup:**

- Register a webhook endpoint in Zoom Marketplace app settings
- Event to subscribe: `recording.completed`
- Zoom sends a payload with `meeting_id`, `recording_files[]` (each with `download_url`, `file_type`, `file_size`)
- **Important:** download URLs include a `?access_token=` param and expire — download immediately

**Webhook endpoint example:** `POST /api/v1/webhooks/zoom/recording-completed`

### 6. Admin Monitoring

- Admin can join any class using the stored `join_url`
- Consider adding the admin as an **alternative host** in meeting settings so they can join without waiting room approval
- Zoom Admin Dashboard also shows active meetings and participants (requires Business plan or higher)

### 7. Teacher Zoom Accounts

Each teacher needs a licensed Zoom user under our organization's Zoom account. The `{userId}` in API calls is the teacher's Zoom user ID or email.

Options:
- **Managed accounts** — create Zoom users via API: `POST /v2/users` (requires Zoom admin privileges)
- **Manual** — add teachers to Zoom org manually, store their Zoom user ID in our DB

### 8. Important Considerations

- **Cloud storage limits:** Zoom plans have limited cloud storage. Downloading to our own storage and deleting from Zoom is essential to avoid hitting limits.
- **Recording download URLs expire:** Never store Zoom's download URLs as permanent links. Always download to our own storage.
- **Privacy/consent:** Zoom shows a recording notice to participants. Our enrollment agreement should mention that classes are recorded.
- **Zoom plan requirements:** Cloud recording requires a Pro plan or higher. Check our current plan supports the number of licensed users (teachers) we need.
- **Rate limits:** Zoom API has rate limits (~10 requests/second). Batch creation of meetings at month start should account for this.
- **Webhook security:** Validate Zoom webhook requests using the `secret_token` verification to prevent spoofed events.

### 9. Implementation Phases

**Phase 1 — Meeting automation**
- Zoom OAuth app setup
- API service for creating/updating/deleting meetings
- Hook into group CRUD in admin panel
- Display join links to teachers and students

**Phase 2 — Recording management**
- Webhook endpoint for `recording.completed`
- Download pipeline to S3/MinIO
- Link recordings to sessions in DB
- "Watch Recording" UI for absent students

**Phase 3 — Enhancements**
- Admin dashboard showing live meeting status
- Attendance tracking via Zoom participant reports (`GET /v2/report/meetings/{meetingId}/participants`)
- Auto-mark absent students based on participant data
