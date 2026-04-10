/**
 * Zoom API service — Server-to-Server OAuth for meeting management.
 *
 * Best-effort pattern: Zoom calls happen AFTER DB transactions.
 * If a call fails, the group operation still succeeds — admin sees a missing link.
 */

// ─── Token management ────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom credentials not configured");
  }

  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: accountId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoom OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function zoomFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`https://api.zoom.us/v2${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/** Convert ISO day (1=Mon…7=Sun) to Zoom day (1=Sun, 2=Mon…7=Sat). */
function isoToZoomDay(isoDay: number): number {
  return (isoDay % 7) + 1;
}

/** Format a Date as "YYYY-MM-DD". */
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

// ─── Meeting CRUD ────────────────────────────────────────────────────────────

export interface CreateMeetingParams {
  zoomEmail: string;
  topic: string;
  startTime: string; // "HH:MM"
  durationMinutes: number;
  days: number[]; // ISO days
  startDate: Date;
  endDate: Date;
}

export interface CreateMeetingResult {
  meetingId: string;
  joinUrl: string;
}

export async function createZoomMeeting(
  params: CreateMeetingParams,
): Promise<CreateMeetingResult | null> {
  try {
    const { zoomEmail, topic, startTime, durationMinutes, days, startDate, endDate } = params;

    const zoomDays = days.map(isoToZoomDay).join(",");
    const startDateTime = `${formatDate(startDate)}T${startTime}:00`;

    const res = await zoomFetch(`/users/${encodeURIComponent(zoomEmail)}/meetings`, {
      method: "POST",
      body: JSON.stringify({
        topic,
        type: 8, // Recurring with fixed time
        start_time: startDateTime,
        duration: durationMinutes,
        timezone: "Asia/Tashkent",
        recurrence: {
          type: 2, // Weekly
          repeat_interval: 1,
          weekly_days: zoomDays,
          end_date_time: `${formatDate(endDate)}T23:59:59Z`,
        },
        settings: {
          join_before_host: true,
          waiting_room: false,
          auto_recording: "cloud",
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Zoom] Failed to create meeting (${res.status}):`, text);
      return null;
    }

    const data = await res.json();
    return {
      meetingId: String(data.id),
      joinUrl: data.join_url,
    };
  } catch (error) {
    console.error("[Zoom] Error creating meeting:", error);
    return null;
  }
}

export async function updateZoomMeeting(
  meetingId: string,
  params: { startTime?: string; durationMinutes?: number },
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {};
    if (params.startTime !== undefined) {
      // Update only the time portion — Zoom keeps the existing recurrence dates
      body.start_time = `${params.startTime}:00`;
    }
    if (params.durationMinutes !== undefined) {
      body.duration = params.durationMinutes;
    }

    const res = await zoomFetch(`/meetings/${meetingId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Zoom] Failed to update meeting ${meetingId} (${res.status}):`, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Zoom] Error updating meeting:", error);
    return false;
  }
}

export async function deleteZoomMeeting(meetingId: string): Promise<boolean> {
  try {
    const res = await zoomFetch(`/meetings/${meetingId}`, {
      method: "DELETE",
    });

    // 204 = deleted, 404 = already gone — both are fine
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      console.error(`[Zoom] Failed to delete meeting ${meetingId} (${res.status}):`, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Zoom] Error deleting meeting:", error);
    return false;
  }
}

/**
 * Delete a specific recording file from Zoom cloud storage.
 * Called after successful download to R2 to free up the 10GB/teacher limit.
 * Uses action=trash (moves to trash, recoverable for 30 days) rather than
 * action=delete (permanent) as a safety net.
 */
export async function deleteZoomRecording(
  meetingId: string,
  recordingFileId: string,
): Promise<boolean> {
  try {
    const res = await zoomFetch(
      `/meetings/${meetingId}/recordings/${recordingFileId}?action=trash`,
      { method: "DELETE" },
    );

    // 200/204 = trashed, 404 = already gone — all fine
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      console.error(
        `[Zoom] Failed to delete recording ${recordingFileId} (${res.status}):`,
        text,
      );
      return false;
    }

    console.log(`[Zoom] Recording ${recordingFileId} moved to trash`);
    return true;
  } catch (error) {
    console.error("[Zoom] Error deleting recording:", error);
    return false;
  }
}

/**
 * Fetch a fresh start_url for a meeting (contains ZAK token for host auth).
 * The start_url expires — call this right before the teacher needs to join.
 */
export async function getZoomStartUrl(meetingId: string): Promise<string | null> {
  try {
    const res = await zoomFetch(`/meetings/${meetingId}`);

    if (!res.ok) {
      console.error(`[Zoom] Failed to get meeting ${meetingId} (${res.status})`);
      return null;
    }

    const data = await res.json();
    return data.start_url ?? null;
  } catch (error) {
    console.error("[Zoom] Error getting start URL:", error);
    return null;
  }
}
