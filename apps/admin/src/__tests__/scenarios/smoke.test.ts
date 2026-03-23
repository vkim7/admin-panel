/**
 * Smoke test — verifies integration test infrastructure works:
 * - Connects to the test Neon branch
 * - Seeds essential reference data
 * - Factories create valid records
 * - Auth mock returns test admin
 * - Server actions can be called and produce expected results
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  prisma,
  truncateAll,
  seedEssentials,
  disconnect,
} from "../helpers/db";
import {
  createTestTeacher,
  createTestStudent,
  createTestGroup,
  createTestFamily,
  expectRedirect,
} from "../helpers/factories";
import { TEST_ADMIN_ID } from "../helpers/constants";

beforeAll(async () => {
  await truncateAll();
  await seedEssentials();
}, 60_000);

afterAll(async () => {
  await truncateAll();
  await disconnect();
});

describe("infrastructure", () => {
  it("connects to the test database", async () => {
    const result = await prisma.$queryRaw<[{ one: number }]>`SELECT 1 as one`;
    expect(result[0]?.one).toBe(1);
  });

  it("seeded essential data", async () => {
    const admin = await prisma.adminUser.findUnique({
      where: { id: TEST_ADMIN_ID },
    });
    expect(admin).toBeTruthy();
    expect(admin!.role).toBe("SUPER_ADMIN");

    const holidays = await prisma.holiday.count();
    expect(holidays).toBeGreaterThan(0);

    const prices = await prisma.priceSetting.count();
    expect(prices).toBe(4);

    const promotions = await prisma.promotion.count();
    expect(promotions).toBe(8);
  });
});

describe("factories", () => {
  it("creates a teacher with rate history", async () => {
    const teacher = await createTestTeacher();
    expect(teacher.id).toBeTruthy();
    expect(teacher.isActive).toBe(true);

    const rate = await prisma.teacherRateChange.findFirst({
      where: { teacherId: teacher.id },
    });
    expect(rate).toBeTruthy();
    expect(rate!.groupLessonRate).toBe(50_000);
  });

  it("creates a student", async () => {
    const student = await createTestStudent({ level: "ELEMENTARY" });
    expect(student.id).toBeTruthy();
    expect(student.level).toBe("ELEMENTARY");
    expect(student.status).toBe("AWAITING_ASSIGNMENT");
  });

  it("creates a family", async () => {
    const family = await createTestFamily({ name: "Test Family" });
    expect(family.id).toBeTruthy();
    expect(family.name).toBe("Test Family");
  });

  it("creates a group with lessons and schedule slots", async () => {
    const { group, teacher, lessonCount } = await createTestGroup({
      level: "BEGINNER",
      days: [1, 3, 5],
      startDate: "2026-04-01",
    });
    expect(group.id).toBeTruthy();
    expect(group.type).toBe("GROUP");
    expect(group.teacherId).toBe(teacher.id);
    expect(lessonCount).toBeGreaterThan(0);

    // Verify lessons were created
    const lessons = await prisma.lesson.count({
      where: { groupId: group.id },
    });
    expect(lessons).toBe(lessonCount);

    // Verify schedule slots match lessons
    const slots = await prisma.teacherScheduleSlot.count({
      where: { groupId: group.id },
    });
    expect(slots).toBe(lessonCount);

    // Verify teacher history
    const history = await prisma.groupTeacherHistory.findFirst({
      where: { groupId: group.id },
    });
    expect(history).toBeTruthy();
    expect(history!.teacherId).toBe(teacher.id);
  });
});

describe("auth mock", () => {
  it("requireAdmin returns test admin", async () => {
    const { requireAdmin } = await import("@/lib/auth");
    const admin = await requireAdmin();
    expect(admin.id).toBe(TEST_ADMIN_ID);
    expect(admin.role).toBe("SUPER_ADMIN");
  });
});

describe("redirect handling", () => {
  it("expectRedirect catches redirect calls", async () => {
    const { redirect } = await import("next/navigation");
    const url = await expectRedirect(async () => {
      redirect("/test-path");
    });
    expect(url).toBe("/test-path");
  });
});
