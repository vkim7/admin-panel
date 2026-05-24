"use client";

import { env } from "@/env.js";

/**
 * Cloudflare Turnstile widget. The Cloudflare script (loaded in the root
 * layout) auto-renders this div and injects a hidden input named
 * `cf-turnstile-response` into the surrounding <form>. The server action
 * reads that field and posts it to siteverify.
 *
 * Theme set to light to match the form card; default size renders the
 * managed (mostly-invisible) widget.
 */
export function Turnstile() {
  return (
    <div
      className="cf-turnstile"
      data-sitekey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      data-theme="light"
    />
  );
}
