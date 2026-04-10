/**
 * Cloudflare Worker: Recording Downloader
 *
 * Streams Zoom recording files directly to R2 without buffering in memory.
 * Called by the Vercel webhook handler, calls back on completion/failure.
 */

interface Env {
  BUCKET: R2Bucket;
  CALLBACK_SECRET: string;
}

interface DownloadRequest {
  zoomDownloadUrl: string;
  zoomAccessToken: string;
  r2Key: string;
  recordingId: string;
  callbackUrl: string;
  callbackSecret: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Validate auth
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${env.CALLBACK_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = (await request.json()) as DownloadRequest;
    const { zoomDownloadUrl, zoomAccessToken, r2Key, recordingId, callbackUrl, callbackSecret } =
      body;

    if (!zoomDownloadUrl || !zoomAccessToken || !r2Key || !recordingId || !callbackUrl) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Process in the background so we return 202 immediately
    // (waitUntil keeps the worker alive until the promise resolves)
    const ctx = { waitUntil: (p: Promise<unknown>) => p };

    // For Cloudflare Workers, we use ctx.waitUntil via the execution context
    // But since we're in the fetch handler, we process and return
    // Actually, let's process synchronously — Workers have generous streaming time

    try {
      // Download from Zoom — handle redirects manually because Authorization
      // headers get stripped on redirect, and Zoom redirects to a CDN
      const separator = zoomDownloadUrl.includes("?") ? "&" : "?";
      const initialUrl = `${zoomDownloadUrl}${separator}access_token=${zoomAccessToken}`;

      console.log(`[Worker] Downloading recording ${recordingId} from Zoom...`);

      // First request: may redirect (302) to CDN
      let zoomRes = await fetch(initialUrl, {
        headers: { Authorization: `Bearer ${zoomAccessToken}` },
        redirect: "manual",
      });

      // Follow redirect if needed (CDN URL has its own auth, no header needed)
      if (zoomRes.status === 301 || zoomRes.status === 302) {
        const redirectUrl = zoomRes.headers.get("location");
        if (!redirectUrl) {
          await sendCallback(callbackUrl, callbackSecret, {
            recordingId,
            status: "failed",
            error: "Zoom redirect has no Location header",
          });
          return new Response("No redirect location", { status: 502 });
        }
        console.log(`[Worker] Following redirect for ${recordingId}...`);
        zoomRes = await fetch(redirectUrl);
      }

      if (!zoomRes.ok) {
        const errorText = await zoomRes.text();
        console.error(`[Worker] Zoom download failed (${zoomRes.status}): ${errorText.slice(0, 200)}`);
        await sendCallback(callbackUrl, callbackSecret, {
          recordingId,
          status: "failed",
          error: `Zoom download failed (${zoomRes.status}): ${errorText.slice(0, 200)}`,
        });
        return new Response("Zoom download failed", { status: 502 });
      }

      if (!zoomRes.body) {
        await sendCallback(callbackUrl, callbackSecret, {
          recordingId,
          status: "failed",
          error: "Zoom response has no body",
        });
        return new Response("No body", { status: 502 });
      }

      // Stream directly to R2
      const contentType = zoomRes.headers.get("content-type") ?? "application/octet-stream";

      await env.BUCKET.put(r2Key, zoomRes.body, {
        httpMetadata: { contentType },
      });

      // Get actual size from R2
      const head = await env.BUCKET.head(r2Key);
      const fileSizeBytes = head?.size ?? 0;

      console.log(`[Worker] Successfully uploaded ${r2Key} (${fileSizeBytes} bytes)`);

      // Callback success
      await sendCallback(callbackUrl, callbackSecret, {
        recordingId,
        status: "completed",
        fileSizeBytes,
      });

      return new Response(JSON.stringify({ status: "ok", r2Key }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Worker] Error processing recording ${recordingId}:`, message);

      try {
        await sendCallback(callbackUrl, callbackSecret, {
          recordingId,
          status: "failed",
          error: message,
        });
      } catch {
        // Callback itself failed — nothing more we can do
      }

      return new Response(`Error: ${message}`, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

async function sendCallback(
  url: string,
  secret: string,
  body: { recordingId: string; status: string; fileSizeBytes?: number; error?: string },
) {
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
}
