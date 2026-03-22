"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleGoogleLogin() {
    setError(null);
    setIsPending(true);
    try {
      await signIn("google", { callbackUrl: "/schedule" });
    } catch {
      setError("Failed to sign in. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={handleGoogleLogin}
        disabled={isPending}
        className="w-full"
        size="lg"
      >
        {isPending ? "Signing in..." : "Sign in with Google"}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
