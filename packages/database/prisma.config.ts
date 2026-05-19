import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// In Prisma 7, this file is what the Prisma CLI reads to resolve the
// migration connection URL. The `datasource.url` here is what
// `prisma migrate deploy` actually connects with.
//
// We prefer a direct (non-pooled) URL for migrations because Neon's
// `-pooler` endpoint does transaction-level pooling, and Prisma's
// pg_advisory_lock() guard against concurrent migrations doesn't survive
// across pooled sessions — symptom: "Timed out trying to acquire a
// postgres advisory lock" during `prisma migrate deploy`.
//
// App runtime still uses DATABASE_URL (pooled) via the adapter in
// src/index.ts — efficient connection reuse there is desirable.
const migrationUrl =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  env("DATABASE_URL");

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: migrationUrl,
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
