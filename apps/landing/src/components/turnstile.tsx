"use client";

import { useEffect, useRef } from "react";
import { env } from "@/env.js";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: { sitekey: string; theme?: "light" | "dark" | "auto" },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile widget — explicit-render mode.
 *
 * The Cloudflare script is loaded in the root layout. We use explicit render
 * (not the `.cf-turnstile` auto-render class) so that React's unmount/remount
 * cycle gets a guaranteed fresh widget with a fresh token. Auto-render's
 * MutationObserver-based detection has a race: when a form re-mounts after a
 * step change (e.g. verify-form's edit-phone), the new widget may not have a
 * token ready before the user submits, causing the server to reject the
 * (missing or stale) `cf-turnstile-response`.
 *
 * Explicit render guarantees: mount → render → fresh token issued; unmount →
 * remove. Next mount starts the cycle over.
 */
export function Turnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tryRender = () => {
      if (cancelled || widgetIdRef.current) return;
      if (!containerRef.current) return;
      if (!window.turnstile) {
        // Script not loaded yet — try again in a bit. The Cloudflare script
        // is loaded with `defer` from the root layout so it may not be ready
        // when this effect first runs.
        setTimeout(tryRender, 100);
        return;
      }
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          theme: "light",
        });
      } catch (err) {
        console.error("[Turnstile] render failed", err);
      }
    };

    tryRender();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget already gone — fine
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} />;
}
