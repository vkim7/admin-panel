"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { loginWithTelegram } from "@/lib/actions/auth";
import type { TelegramAuthData } from "@/lib/auth";

// Make the Telegram callback available globally
declare global {
  interface Window {
    onTelegramAuth: (user: TelegramAuthData) => void;
  }
}

export function LoginForm({ botUsername }: { botUsername?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const widgetRef = useRef<HTMLDivElement>(null);

  // Mount the Telegram Login Widget
  useEffect(() => {
    if (!botUsername || !widgetRef.current) return;

    // Set up the callback before loading the script
    window.onTelegramAuth = (user: TelegramAuthData) => {
      setError(null);
      startTransition(async () => {
        const result = await loginWithTelegram(user);
        if (result?.error) setError(result.error);
      });
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    widgetRef.current.appendChild(script);

    return () => {
      delete (window as Partial<Window>).onTelegramAuth;
    };
  }, [botUsername]);

  return (
    <div className="space-y-4">
      {botUsername ? (
        <div ref={widgetRef} className="flex justify-center" />
      ) : (
        <p className="text-sm text-muted-foreground">
          Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME to enable login.
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isPending && !error && (
        <p className="text-sm text-muted-foreground">Verifying...</p>
      )}
    </div>
  );
}
