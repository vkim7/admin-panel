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
  zoomDownloadToken: string; // JWT from webhook payload, valid 24h
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
    const { zoomDownloadUrl, zoomDownloadToken, r2Key, recordingId, callbackUrl, callbackSecret } =
      body;

    if (!zoomDownloadUrl || !zoomDownloadToken || !r2Key || !recordingId || !callbackUrl) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Process in the background so we return 202 immediately
    // (waitUntil keeps the worker alive until the promise resolves)
    const ctx = { waitUntil: (p: Promise<unknown>) => p };

    // For Cloudflare Workers, we use ctx.waitUntil via the execution context
    // But since we're in the fetch handler, we process and return
    // Actually, let's process synchronously — Workers have generous streaming time

    try {
      // Download from Zoom using the download_token (JWT) from the webhook
      // payload as a Bearer header. S2S OAuth tokens do NOT work for downloads.
      console.log(`[Worker] Downloading recording ${recordingId} from Zoom...`);

      let zoomRes = await fetch(zoomDownloadUrl, {
        headers: { Authorization: `Bearer ${zoomDownloadToken}` },
        redirect: "manual",
      });

      console.log(`[Worker] Initial response: ${zoomRes.status}`);

      // Follow redirect if needed (CDN URL has its own auth)
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
        console.log(`[Worker] Redirect response: ${zoomRes.status}`);
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
