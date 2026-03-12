import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Telegram bot token for Login Widget HMAC validation.
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    // Secret for signing session JWTs. Must be set in production.
    AUTH_SECRET: z.string().min(1).default("dev-secret-do-not-use-in-production"),
  },
  client: {
    // Bot username for the Telegram Login Widget (without @).
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().min(1).optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME:
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
