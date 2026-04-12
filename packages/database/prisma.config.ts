import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
    // Optional: only needed for `migrate dev`, not `migrate deploy`
    ...(process.env.SHADOW_DATABASE_URL && {
      shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
    }),
  },
  migrate: {
    async adapter() {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      return new PrismaPg({ connectionString: env("DATABASE_URL") });
    },
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
