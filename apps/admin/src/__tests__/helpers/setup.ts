/**
 * Global setup file for integration tests.
 *
 * Runs before all test files. Sets up module mocks for:
 * - next/cache (revalidatePath → no-op)
 * - next/navigation (redirect → throws RedirectError)
 * - @/lib/auth (requireAdmin → returns TEST_ADMIN)
 * - @/auth (prevents NextAuth initialization)
 */
import { vi } from "vitest";
import { TEST_ADMIN, TEST_ADMIN_ID } from "./constants";

// ─── Custom Errors ──────────────────────────────────────────────────────────

/** Thrown by the mocked redirect(). Catch in tests to assert redirect URLs. */
export class RedirectError extends Error {
  url: string;
  constructor(url: string) {
    super(`NEXT_REDIRECT: ${url}`);
    this.url = url;
    this.name = "RedirectError";
  }
}

// ─── Next.js Module Mocks ───────────────────────────────────────────────────

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string): never => {
    throw new RedirectError(url);
  }),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// ─── Auth Mock ──────────────────────────────────────────────────────────────
// All server actions call requireAdmin() or requireRole() as their first line.
// The mock returns TEST_ADMIN (matching the DB record created by seedEssentials).

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    id: TEST_ADMIN_ID,
    email: "test-admin@example.com",
    telegramId: null,
    firstName: "Test",
    lastName: "Admin",
    username: null,
    role: "SUPER_ADMIN",
    isActive: true,
  }),
  requireRole: vi.fn().mockResolvedValue({
    id: TEST_ADMIN_ID,
    email: "test-admin@example.com",
    telegramId: null,
    firstName: "Test",
    lastName: "Admin",
    username: null,
    role: "SUPER_ADMIN",
    isActive: true,
  }),
  getSession: vi.fn().mockResolvedValue({
    adminId: TEST_ADMIN_ID,
    role: "SUPER_ADMIN",
  }),
  getCurrentAdmin: vi.fn().mockResolvedValue({
    id: TEST_ADMIN_ID,
    email: "test-admin@example.com",
    telegramId: null,
    firstName: "Test",
    lastName: "Admin",
    username: null,
    role: "SUPER_ADMIN",
    isActive: true,
  }),
}));

// Prevent NextAuth from initializing (it would fail without full env vars).
// Server actions only import from @/lib/auth (mocked above), but mock @/auth
// as a safety net in case anything imports it transitively.
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));
