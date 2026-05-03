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
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    META_TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
