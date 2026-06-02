import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    META_ACCESS_TOKEN: z.string().min(1),
    META_TEST_EVENT_CODE: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1),
    // Comma-separated list of E.164 phone numbers permitted to use the /verify
    // flow. Empty / unset = no restriction (rollout flag — set during initial
    // testing, clear when opening to all phones).
    VERIFY_ALLOWLIST_PHONES: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    META_TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    VERIFY_ALLOWLIST_PHONES: process.env.VERIFY_ALLOWLIST_PHONES,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
