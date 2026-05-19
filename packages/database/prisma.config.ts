import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrate: {
    async adapter() {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      // Use a direct (non-pooled) connection for migrations when available.
      // Neon's `-pooler` endpoint does transaction-level pooling, and Prisma's
      // pg_advisory_lock() guard against concurrent migrations doesn't survive
      // across pooled connections — the lock acquires on one physical session
      // and gets dropped when the next query lands on a different one. Symptom
      // in CI: "Timed out trying to acquire a postgres advisory lock".
      //
      // Accept the common direct-URL env names so the project works with
      // multiple Neon / Vercel integration variants without manual aliasing.
      const connectionString =
        process.env.DIRECT_DATABASE_URL ||
        process.env.DATABASE_URL_UNPOOLED ||
        process.env.POSTGRES_URL_NON_POOLING ||
        env("DATABASE_URL");
      return new PrismaPg({ connectionString });
    },
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
