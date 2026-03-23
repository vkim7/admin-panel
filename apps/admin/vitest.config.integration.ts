import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";

// ─── Load .env.test ─────────────────────────────────────────────────────────
// Parse env file and pass values to vitest's `env` option so they're set in
// process.env before any module (including @eng/database) reads DATABASE_URL.

function loadEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const testEnv = loadEnvFile(path.resolve(__dirname, ".env.test"));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/scenarios/**/*.test.ts"],
    setupFiles: ["src/__tests__/helpers/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Shared DB state — run test files sequentially
    fileParallelism: false,
    env: testEnv,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
