import { env } from "@/env.js";

/**
 * Verify a Cloudflare Turnstile token against siteverify.
 * Returns true if the token is valid and present, false otherwise.
 *
 * Called from the lead-submit server action before any DB writes. Network
 * failures are treated as verification failures — fail closed, because the
 * whole point of this check is to reject bot traffic, and a flaky Cloudflare
 * call shouldn't become a bypass.
 */
export async function verifyTurnstileToken(
  token: string | null,
  clientIp: string | null,
): Promise<boolean> {
  if (!token) return false;

  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  if (clientIp) body.set("remoteip", clientIp);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    if (!res.ok) {
      console.error(
        `[Turnstile] siteverify HTTP ${res.status} ${res.statusText}`,
      );
      return false;
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      console.warn(
        `[Turnstile] verification failed: ${data["error-codes"]?.join(",") ?? "unknown"}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Turnstile] siteverify call threw", err);
    return false;
  }
}
