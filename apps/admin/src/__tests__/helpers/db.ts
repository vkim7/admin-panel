/**
 * Database utilities for integration tests.
 *
 * Provides:
 * - truncateAll()     — wipe everything (full reset)
 * - cleanupTestData() — wipe test data, keep reference/seed records
 * - seedEssentials()  — insert required reference data (admin, holidays, reasons, prices, promotions)
 * - disconnect()      — close the Prisma connection
 *
 * Usage in test files:
 *   beforeAll(async () => { await truncateAll(); await seedEssentials(); });
 *   afterEach(async () => { await cleanupTestData(); });
 *   afterAll(async () => { await disconnect(); });
 */
import { prisma } from "@/server/db";
import { TEST_ADMIN_ID } from "./constants";

export { prisma };

// ─── Table Lists ────────────────────────────────────────────────────────────

const ALL_TABLES = [
  "AppliedPromotion",
  "PaymentPeriodAdjustment",
  "Refund",
  "Payment",
  "StudentPaymentPeriod",
  "TeacherPaymentPeriod",
  "Attendance",
  "Exam",
  "Lesson",
  "TeacherScheduleSlot",
  "GroupMembership",
  "GroupTeacherHistory",
  "Group",
  "TeacherAvailability",
  "TeacherUnavailability",
  "TeacherRateChange",
  "Teacher",
  "StudentPromotion",
  "Referral",
  "UncertainHistory",
  "Student",
  "Family",
  "CallHistory",
  "SmsHistory",
  "Promotion",
  "PriceSetting",
  "Holiday",
  "TransferReason",
  "LostReason",
  "CancellationReason",
  "UncertainReason",
  "AdminUser",
];

/** Tables that contain test-specific data (not reference/seed data). */
const DATA_TABLES = [
  "AppliedPromotion",
  "PaymentPeriodAdjustment",
  "Refund",
  "Payment",
  "StudentPaymentPeriod",
  "TeacherPaymentPeriod",
  "Attendance",
  "Exam",
  "Lesson",
  "TeacherScheduleSlot",
  "GroupMembership",
  "GroupTeacherHistory",
  "Group",
  "TeacherAvailability",
  "TeacherUnavailability",
  "TeacherRateChange",
  "Teacher",
  "StudentPromotion",
  "Referral",
  "UncertainHistory",
  "Student",
  "Family",
  "CallHistory",
  "SmsHistory",
];

// ─── Cleanup ────────────────────────────────────────────────────────────────

/** Truncate ALL tables and restart identity sequences. */
export async function truncateAll() {
  const tableList = ALL_TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}

/** Truncate test data tables only — keeps reference data (admin, holidays, reasons, prices, promotions). */
export async function cleanupTestData() {
  const tableList = DATA_TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}

// ─── Seed Essentials ────────────────────────────────────────────────────────

/**
 * Insert reference data required by server actions.
 * Mirrors production seed.ts with minimal data and known IDs.
 * Call after truncateAll() to set up a clean baseline.
 */
export async function seedEssentials() {
  // ─── Admin User (matches TEST_ADMIN in setup.ts mock) ──────────────────
  await prisma.adminUser.create({
    data: {
      id: TEST_ADMIN_ID,
      email: "test-admin@example.com",
      firstName: "Test",
      lastName: "Admin",
      role: "SUPER_ADMIN",
    },
  });

  // ─── Holidays (minimal set — enough for lesson generation tests) ───────
  await prisma.holiday.createMany({
    data: [
      { date: new Date("2026-01-01"), name: "New Year" },
      { date: new Date("2026-03-08"), name: "Women's Day" },
      { date: new Date("2026-03-21"), name: "Navruz" },
    ],
  });

  // ─── Transfer Reasons ──────────────────────────────────────────────────
  await prisma.transferReason.createMany({
    data: [
      { name: "Teacher dissatisfaction", sortOrder: 1 },
      { name: "Level too low", sortOrder: 2 },
      { name: "Other", isOther: true, sortOrder: 3 },
    ],
  });

  // ─── Lost Reasons ─────────────────────────────────────────────────────
  await prisma.lostReason.createMany({
    data: [
      { name: "Taking a break", sortOrder: 1 },
      { name: "Too expensive", sortOrder: 2 },
      { name: "Other", isOther: true, sortOrder: 3 },
      { name: "Trial no-show (Group)", sortOrder: 10 },
      { name: "Trial no-show — final attempt (Group)", sortOrder: 11 },
      { name: "Trial no-show (Individual)", sortOrder: 12 },
      { name: "Trial — didn't continue (Group)", sortOrder: 13 },
      { name: "Trial — didn't continue (Individual)", sortOrder: 14 },
    ],
  });

  // ─── Uncertain Reasons ───────────────────────────────────────────────
  await prisma.uncertainReason.createMany({
    data: [
      { name: "Late to lessons", sortOrder: 1 },
      { name: "Misses classes", sortOrder: 2 },
      { name: "Declining engagement", sortOrder: 3 },
      { name: "Other", isOther: true, sortOrder: 4 },
    ],
  });

  // ─── Cancellation Reasons ─────────────────────────────────────────────
  await prisma.cancellationReason.createMany({
    data: [
      { name: "Teacher absence", sortOrder: 1 },
      { name: "Student request", sortOrder: 2 },
      { name: "Other", isOther: true, sortOrder: 3 },
    ],
  });

  // ─── Price Settings ───────────────────────────────────────────────────
  await prisma.priceSetting.createMany({
    data: [
      {
        levelCategory: "GENERAL",
        groupType: "GROUP",
        pricePerLesson: 47_500,
        effectiveFrom: new Date("2025-01-01"),
        changedById: TEST_ADMIN_ID,
      },
      {
        levelCategory: "GENERAL",
        groupType: "INDIVIDUAL",
        pricePerLesson: 200_000,
        effectiveFrom: new Date("2025-01-01"),
        changedById: TEST_ADMIN_ID,
      },
      {
        levelCategory: "IELTS",
        groupType: "GROUP",
        pricePerLesson: 47_500,
        effectiveFrom: new Date("2025-01-01"),
        changedById: TEST_ADMIN_ID,
      },
      {
        levelCategory: "IELTS",
        groupType: "INDIVIDUAL",
        pricePerLesson: 200_000,
        effectiveFrom: new Date("2025-01-01"),
        changedById: TEST_ADMIN_ID,
      },
    ],
  });

  // ─── System Promotions ────────────────────────────────────────────────
  await prisma.promotion.createMany({
    data: [
      {
        name: "Trial Group Free Lesson",
        type: "TRIAL",
        discountType: "PERCENTAGE",
        discountPercent: 100,
        groupTypes: ["GROUP"],
        isRecurring: false,
        maxUsesPerStudent: 1,
        isActive: true,
      },
      {
        name: "Trial Individual 50%",
        type: "TRIAL",
        discountType: "PERCENTAGE",
        discountPercent: 50,
        groupTypes: ["INDIVIDUAL"],
        isRecurring: false,
        maxUsesPerStudent: 1,
        isActive: true,
      },
      {
        name: "Referral Reward",
        type: "REFERRAL",
        discountType: "FIXED_AMOUNT",
        discountAmount: 70_000,
        isRecurring: false,
        maxUsesPerStudent: 1,
        isActive: true,
      },
      {
        name: "Referral Welcome",
        type: "REFERRAL",
        discountType: "FIXED_AMOUNT",
        discountAmount: 70_000,
        isRecurring: false,
        maxUsesPerStudent: 1,
        isActive: true,
      },
      {
        name: "Family Discount",
        type: "FAMILY",
        discountType: "FIXED_AMOUNT",
        discountAmount: 70_000,
        isRecurring: true,
        isActive: true,
      },
      {
        name: "Win-Back Discount",
        type: "WIN_BACK",
        discountType: "FIXED_AMOUNT",
        discountAmount: 70_000,
        isRecurring: false,
        maxUsesPerStudent: 1,
        isActive: true,
      },
      {
        name: "Apology Discount",
        type: "APOLOGY",
        discountType: "FIXED_AMOUNT",
        discountAmount: 70_000,
        isRecurring: false,
        isActive: true,
      },
      {
        name: "Reward Discount",
        type: "REWARD",
        discountType: "FIXED_AMOUNT",
        discountAmount: 70_000,
        isRecurring: false,
        isActive: true,
      },
    ],
  });
}

// ─── Connection ─────────────────────────────────────────────────────────────

/** Disconnect the Prisma client. Call in the final afterAll. */
export async function disconnect() {
  await prisma.$disconnect();
}
