/**
 * Phase 6: Teacher Management — CRUD, Rates, Availability, Pay
 *
 * Tests teacher creation, deactivation, rate changes, availability overlap
 * detection, teacher pay generation (per-student-hour), rate lookups, and
 * marking teachers as paid.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  prisma,
  truncateAll,
  seedEssentials,
  cleanupTestData,
  disconnect,
} from "../helpers/db";
import {
  createTestTeacher,
  createTestStudent,
  createTestGroup,
  createTestMembership,
  expectRedirect,
} from "../helpers/factories";

const importTeachers = () => import("@/lib/actions/teachers");
const importTeacherPayments = () => import("@/lib/actions/teacher-payments");
const importLessons = () => import("@/lib/actions/lessons");
const importAttendance = () => import("@/lib/actions/attendance");

beforeAll(async () => {
  await truncateAll();
  await seedEssentials();
}, 60_000);

afterAll(async () => {
  await truncateAll();
  await disconnect();
});

beforeEach(async () => {
  await cleanupTestData();
});

// ─── Teacher CRUD ───────────────────────────────────────────────────────────

describe("teacher CRUD", () => {
  it("rejects duplicate phone number", async () => {
    const { createTeacher } = await importTeachers();

    const phone = "+998901234567";
    await expectRedirect(() =>
      createTeacher({
        firstName: "Test",
        lastName: "Teacher1",
        phone,
        levels: ["BEGINNER"],
        teachingLanguage: "ANY",
      }),
    );

    const result = await createTeacher({
      firstName: "Test",
      lastName: "Teacher2",
      phone,
      levels: ["BEGINNER"],
      teachingLanguage: "ANY",
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/phone.*already exists/i);
  });
});

// ─── C#20: Availability Overlap ─────────────────────────────────────────────

describe("C#20: availability overlap", () => {
  it("rejects overlapping time blocks on same day", async () => {
    const { setAvailability } = await importTeachers();
    const teacher = await createTestTeacher();

    const result = await setAvailability(teacher.id, [
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
      { dayOfWeek: 1, startTime: "11:00", endTime: "14:00" }, // overlaps
    ]);

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/overlap/i);
  });

  it("allows non-overlapping blocks on same day", async () => {
    const { setAvailability } = await importTeachers();
    const teacher = await createTestTeacher();

    const result = await setAvailability(teacher.id, [
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
      { dayOfWeek: 1, startTime: "13:00", endTime: "16:00" }, // no overlap
    ]);

    expect(result).toEqual({ success: true });
  });
});

// ─── C#14: Rate Changes ─────────────────────────────────────────────────────

describe("C#14: rate changes", () => {
  it("add rate change → stored correctly", async () => {
    const { addRateChange } = await importTeachers();
    const teacher = await createTestTeacher();

    const result = await addRateChange(teacher.id, {
      groupLessonRate: 80_000,
      individualLessonRate: 150_000,
      effectiveFrom: "2026-04-01",
    });

    expect(result).toEqual({ success: true });

    // Verify rate was created
    const rate = await prisma.teacherRateChange.findFirst({
      where: {
        teacherId: teacher.id,
        effectiveFrom: new Date("2026-04-01T00:00:00Z"),
      },
    });
    expect(rate).toBeTruthy();
    expect(rate!.groupLessonRate).toBe(80_000);
    expect(rate!.individualLessonRate).toBe(150_000);
  });
});

// ─── C#11: Teacher Deactivation ─────────────────────────────────────────────

describe("C#11: teacher deactivation", () => {
  it("rejects deactivation with active groups", async () => {
    const { deactivateTeacher } = await importTeachers();

    const teacher = await createTestTeacher();
    await createTestGroup({ teacherId: teacher.id });

    const result = await deactivateTeacher(teacher.id);
    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/active groups/i);
  });

  it("succeeds with no active groups", async () => {
    const { deactivateTeacher } = await importTeachers();
    const teacher = await createTestTeacher();

    // No groups created
    const url = await expectRedirect(() => deactivateTeacher(teacher.id));
    expect(url).toBe("/teachers");

    const updated = await prisma.teacher.findUnique({
      where: { id: teacher.id },
    });
    expect(updated!.isActive).toBe(false);
    expect(updated!.deactivatedAt).toBeTruthy();
  });
});

// ─── C#37: Teacher Pay Generation ───────────────────────────────────────────

describe("C#37: teacher pay generation", () => {
  it("generates correct per-student-hour pay (totalStudentLessons × rate)", async () => {
    const { generateTeacherPay } = await importTeacherPayments();
    const { completeLesson } = await importLessons();
    const { initializeAttendance } = await importAttendance();

    // Create group starting in February (past month)
    const teacher = await createTestTeacher({ groupLessonRate: 50_000 });
    const { group } = await createTestGroup({
      teacherId: teacher.id,
      startDate: "2026-02-01",
      startTime: "14:30",
    });

    // Add 2 students
    const s1 = await createTestStudent();
    const s2 = await createTestStudent();
    const pastJoin = new Date("2026-01-15");
    await createTestMembership({ studentId: s1.id, groupId: group.id, joinDate: pastJoin });
    await createTestMembership({ studentId: s2.id, groupId: group.id, joinDate: pastJoin });

    // Get 2 February lessons
    const febLessons = await prisma.lesson.findMany({
      where: {
        groupId: group.id,
        status: "SCHEDULED",
        lessonDate: {
          gte: new Date("2026-02-01"),
          lt: new Date("2026-03-01"),
        },
      },
      orderBy: { lessonDate: "asc" },
      take: 2,
    });
    expect(febLessons.length).toBe(2);

    // Initialize attendance + complete each lesson
    for (const lesson of febLessons) {
      await initializeAttendance({ lessonId: lesson.id });
      await completeLesson({ lessonId: lesson.id });
    }

    // Verify activeStudentCount was set
    const completed = await prisma.lesson.findMany({
      where: { id: { in: febLessons.map((l) => l.id) } },
    });
    for (const l of completed) {
      expect(l.status).toBe("COMPLETED");
      expect(l.activeStudentCount).toBe(2);
    }

    // Generate pay for February 2026
    const result = await generateTeacherPay({ year: 2026, month: 2 });
    expect(result).toHaveProperty("success", true);
    expect(result.created).toBeGreaterThanOrEqual(1);

    // Verify pay record
    const payRecord = await prisma.teacherPaymentPeriod.findFirst({
      where: {
        teacherId: teacher.id,
        groupId: group.id,
        periodYear: 2026,
        periodMonth: 2,
      },
    });
    expect(payRecord).toBeTruthy();
    expect(payRecord!.lessonsCompleted).toBe(2);
    expect(payRecord!.totalStudentLessons).toBe(4); // 2 students × 2 lessons
    expect(payRecord!.rate).toBe(50_000);
    expect(payRecord!.amount).toBe(4 * 50_000); // 200_000
    expect(payRecord!.status).toBe("UNPAID");
  });

  it("uses rate effective at period start, not current rate", async () => {
    const { generateTeacherPay } = await importTeacherPayments();
    const { addRateChange } = await importTeachers();
    const { completeLesson } = await importLessons();
    const { initializeAttendance } = await importAttendance();

    // Teacher with old rate (50K effective Jan 2025)
    const teacher = await createTestTeacher({ groupLessonRate: 50_000 });

    const { group } = await createTestGroup({
      teacherId: teacher.id,
      startDate: "2026-02-01",
      startTime: "16:00",
      days: [2, 4, 6],
    });

    // Add 1 student, complete 1 Feb lesson
    const student = await createTestStudent();
    await createTestMembership({
      studentId: student.id,
      groupId: group.id,
      joinDate: new Date("2026-01-15"),
    });

    const febLesson = await prisma.lesson.findFirst({
      where: {
        groupId: group.id,
        status: "SCHEDULED",
        lessonDate: { gte: new Date("2026-02-01"), lt: new Date("2026-03-01") },
      },
    });
    expect(febLesson).toBeTruthy();

    await initializeAttendance({ lessonId: febLesson!.id });
    await completeLesson({ lessonId: febLesson!.id });

    // Add NEW rate effective March 2026 (after Feb)
    await addRateChange(teacher.id, {
      groupLessonRate: 80_000,
      individualLessonRate: 200_000,
      effectiveFrom: "2026-03-01",
    });

    // Generate pay for Feb 2026 → should use OLD rate (50K)
    const result = await generateTeacherPay({ year: 2026, month: 2 });
    expect(result).toHaveProperty("success", true);

    const payRecord = await prisma.teacherPaymentPeriod.findFirst({
      where: { teacherId: teacher.id, periodYear: 2026, periodMonth: 2 },
    });
    expect(payRecord).toBeTruthy();
    expect(payRecord!.rate).toBe(50_000); // Old rate, not 80K
  });
});

// ─── Mark Teacher Paid ──────────────────────────────────────────────────────

describe("mark teacher paid", () => {
  it("marks all UNPAID records for teacher in month as PAID", async () => {
    const { generateTeacherPay, markTeacherPaid } =
      await importTeacherPayments();
    const { completeLesson } = await importLessons();
    const { initializeAttendance } = await importAttendance();

    const teacher = await createTestTeacher({ groupLessonRate: 50_000 });
    const { group } = await createTestGroup({
      teacherId: teacher.id,
      startDate: "2026-02-01",
      startTime: "08:30",
    });

    const student = await createTestStudent();
    await createTestMembership({
      studentId: student.id,
      groupId: group.id,
      joinDate: new Date("2026-01-15"),
    });

    // Complete 1 Feb lesson
    const febLesson = await prisma.lesson.findFirst({
      where: {
        groupId: group.id,
        status: "SCHEDULED",
        lessonDate: { gte: new Date("2026-02-01"), lt: new Date("2026-03-01") },
      },
    });
    await initializeAttendance({ lessonId: febLesson!.id });
    await completeLesson({ lessonId: febLesson!.id });

    // Generate pay
    await generateTeacherPay({ year: 2026, month: 2 });

    // Verify UNPAID
    const before = await prisma.teacherPaymentPeriod.findMany({
      where: { teacherId: teacher.id, periodYear: 2026, periodMonth: 2 },
    });
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((r) => r.status === "UNPAID")).toBe(true);

    // Mark as paid
    const result = await markTeacherPaid({
      teacherId: teacher.id,
      year: 2026,
      month: 2,
    });
    expect(result).toHaveProperty("success", true);

    // All should be PAID now
    const after = await prisma.teacherPaymentPeriod.findMany({
      where: { teacherId: teacher.id, periodYear: 2026, periodMonth: 2 },
    });
    expect(after.every((r) => r.status === "PAID")).toBe(true);
    expect(after.every((r) => r.paidAt !== null)).toBe(true);
  });
});
