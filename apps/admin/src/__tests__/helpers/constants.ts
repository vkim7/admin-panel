// Shared constants for integration tests.
// The admin ID must match the record created by seedEssentials().

export const TEST_ADMIN_ID = "test-admin-000000000000000";

export const TEST_ADMIN = {
  id: TEST_ADMIN_ID,
  email: "test-admin@example.com",
  telegramId: null,
  firstName: "Test",
  lastName: "Admin",
  username: null,
  role: "SUPER_ADMIN" as const,
  isActive: true,
};
