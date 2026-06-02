"use client";

import { useEffect, useRef } from "react";
import { env } from "@/env.js";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

interface TurnstileProps {
  /**
   * Fired with `true` when the widget has a valid token (`callback`), and
   * `false` when the token expires or errors out. Use this to gate form
   * submission — without it, a user who clicks the submit button before the
   * widget finishes obtaining a token will send an empty
   * `cf-turnstile-response` and the server will reject the request.
   */
  onReady?: (ready: boolean) => void;
}

/**
 * Cloudflare Turnstile widget — explicit-render mode.
 *
 * The Cloudflare script is loaded in the root layout. We use explicit render
 * (not the `.cf-turnstile` auto-render class) so that React's unmount/remount
 * cycle gets a guaranteed fresh widget with a fresh token. The widget still
 * inserts its own hidden `cf-turnstile-response` input into the container,
 * which the surrounding form picks up via FormData on submit.
 *
 * Token readiness is reported via `onReady` — pass `false` when the widget
 * has no valid token (just mounted, error, expired) and `true` when it does.
 */
export function Turnstile({ onReady }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Capture latest callback in a ref so the useEffect doesn't re-run on every
  // parent render (which would tear down + re-render the widget).
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    onReadyRef.current?.(false);

    const tryRender = () => {
      if (cancelled || widgetIdRef.current) return;
      if (!containerRef.current) return;
      if (!window.turnstile) {
        // Script not loaded yet — the Cloudflare api.js is `defer`ed from the
        // root layout, so it may not be ready when this effect first runs.
        setTimeout(tryRender, 100);
        return;
      }
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          theme: "light",
          callback: () => onReadyRef.current?.(true),
          "error-callback": () => onReadyRef.current?.(false),
          "expired-callback": () => onReadyRef.current?.(false),
        });
      } catch (err) {
        console.error("[Turnstile] render failed", err);
      }
    };

    tryRender();

    return () => {
      cancelled = true;
      onReadyRef.current?.(false);
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
