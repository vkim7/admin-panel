/**
 * Phase 2: Constraint Enforcement
 *
 * Tests that the system correctly rejects invalid operations. Each test
 * targets a specific constraint (C#N) from schema.prisma.
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
  createTestStudent,
  createTestTeacher,
  createTestGroup,
  createTestMembership,
  expectRedirect,
} from "../helpers/factories";
import { TEST_ADMIN_ID } from "../helpers/constants";

const importMemberships = () => import("@/lib/actions/group-memberships");
const importGroups = () => import("@/lib/actions/groups");
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

// ─── C#3: Group Capacity ────────────────────────────────────────────────────

describe("C#3: group capacity", () => {
  it("rejects adding student when group is full", async () => {
    const { addStudentsToGroup } = await importMemberships();

    // Create a group with maxStudents=2 for easy testing
    const { group } = await createTestGroup({ maxStudents: 2 });

    // Fill the group
    const s1 = await createTestStudent();
    const s2 = await createTestStudent();
    await createTestMembership({ studentId: s1.id, groupId: group.id, joinDate: new Date("2026-04-01") });
    await createTestMembership({ studentId: s2.id, groupId: group.id, joinDate: new Date("2026-04-01") });

    // Try to add a 3rd student
    const s3 = await createTestStudent();
    const result = await addStudentsToGroup(group.id, {
      studentIds: [s3.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/capacity|slot/i);
  });
});

// ─── C#40: Schedule Conflict ────────────────────────────────────────────────

describe("C#40: schedule conflicts", () => {
  it("rejects adding student to overlapping group (same days + overlapping time)", async () => {
    const { addStudentsToGroup } = await importMemberships();
    const teacher1 = await createTestTeacher();
    const teacher2 = await createTestTeacher();

    // Two groups with same schedule (same days, same time, different teachers)
    const { group: groupA } = await createTestGroup({
      teacherId: teacher1.id,
      days: [1, 3, 5],
      startTime: "14:30",
    });
    const { group: groupB } = await createTestGroup({
      teacherId: teacher2.id,
      days: [1, 3, 5],
      startTime: "14:30",
    });

    const student = await createTestStudent();

    // Assign to group A (succeeds)
    await addStudentsToGroup(groupA.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    // Try to assign to group B (same schedule → conflict)
    const result = await addStudentsToGroup(groupB.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/already in group.*at this time/i);
  });

  it("allows adding student to non-overlapping group (different days)", async () => {
    const { addStudentsToGroup } = await importMemberships();
    const teacher1 = await createTestTeacher();
    const teacher2 = await createTestTeacher();

    const { group: groupA } = await createTestGroup({
      teacherId: teacher1.id,
      days: [1, 3, 5],
      startTime: "14:30",
    });
    const { group: groupB } = await createTestGroup({
      teacherId: teacher2.id,
      days: [2, 4, 6],
      startTime: "14:30",
    });

    const student = await createTestStudent();

    await addStudentsToGroup(groupA.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const result = await addStudentsToGroup(groupB.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    expect(result).toEqual({ success: true });
  });
});

// ─── C#40: Language Enforcement ─────────────────────────────────────────────

describe("C#40: language enforcement", () => {
  it("rejects BEGINNER student (UZBEK) assigned to RUSSIAN-only teacher", async () => {
    const { addStudentsToGroup } = await importMemberships();

    const teacher = await createTestTeacher({
      teachingLanguage: "RUSSIAN",
      levels: ["BEGINNER"],
    });
    const { group } = await createTestGroup({
      teacherId: teacher.id,
      level: "BEGINNER",
    });

    const student = await createTestStudent({
      level: "BEGINNER",
      preferredLanguage: "UZBEK",
    });

    const result = await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/uzbek/i);
  });

  it("allows INTERMEDIATE student regardless of language preference (soft only)", async () => {
    const { addStudentsToGroup } = await importMemberships();

    const teacher = await createTestTeacher({
      teachingLanguage: "RUSSIAN",
      levels: ["INTERMEDIATE"],
    });
    const { group } = await createTestGroup({
      teacherId: teacher.id,
      level: "INTERMEDIATE",
    });

    const student = await createTestStudent({
      level: "INTERMEDIATE",
      preferredLanguage: "UZBEK",
    });

    const result = await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    expect(result).toEqual({ success: true });
  });
});

// ─── C#2: Trial Limits ──────────────────────────────────────────────────────

describe("C#2: trial limits", () => {
  it("3rd GROUP trial → auto non-trial (limit is 2)", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const student = await createTestStudent();

    // Use 2 trials across different groups
    for (let i = 0; i < 2; i++) {
      const { group } = await createTestGroup({
        startTime: i === 0 ? "14:30" : "16:00",
        days: i === 0 ? [1, 3, 5] : [2, 4, 6],
      });

      await addStudentsToGroup(group.id, {
        studentIds: [student.id],
        joinDate: "2026-04-01",
        comment: null,
      });

      const m = await prisma.groupMembership.findFirst({
        where: { studentId: student.id, groupId: group.id },
      });
      expect(m!.isTrial).toBe(true);

      await resolveTrialMembership(m!.id, { action: "didnt_continue" });

      // Reset student status for next assignment
      await prisma.student.update({
        where: { id: student.id },
        data: {
          status: "AWAITING_REASSIGNMENT",
          inactivatedAt: null,
          inactivatedById: null,
          lostReasonId: null,
          otherLostReason: null,
        },
      });
    }

    // 3rd assignment → should be non-trial
    const { group: group3 } = await createTestGroup({ startTime: "08:30" });
    await addStudentsToGroup(group3.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const m3 = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group3.id },
    });
    expect(m3!.isTrial).toBe(false);
  });

  it("2nd INDIVIDUAL trial → auto non-trial (limit is 1)", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const student = await createTestStudent();

    // 1st INDIVIDUAL trial
    const { group: ind1 } = await createTestGroup({
      type: "INDIVIDUAL",
      maxStudents: 1,
      startTime: "14:30",
    });

    await addStudentsToGroup(ind1.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const m1 = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: ind1.id },
    });
    expect(m1!.isTrial).toBe(true);

    await resolveTrialMembership(m1!.id, { action: "didnt_continue" });

    await prisma.student.update({
      where: { id: student.id },
      data: {
        status: "AWAITING_REASSIGNMENT",
        inactivatedAt: null,
        inactivatedById: null,
        lostReasonId: null,
        otherLostReason: null,
      },
    });

    // 2nd INDIVIDUAL → should be non-trial
    const { group: ind2 } = await createTestGroup({
      type: "INDIVIDUAL",
      maxStudents: 1,
      startTime: "16:00",
      days: [2, 4, 6],
    });

    await addStudentsToGroup(ind2.id, {
      studentIds: [student.id],
      joinDate: "2026-04-02",
      comment: null,
    });

    const m2 = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: ind2.id },
    });
    expect(m2!.isTrial).toBe(false);
  });
});

// ─── C#18: Attendance Initialization ────────────────────────────────────────

describe("C#18: attendance initialization", () => {
  it("creates attendance records for active members only", async () => {
    const { initializeAttendance } = await importAttendance();
    const { group } = await createTestGroup({ startDate: "2026-04-01" });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const pastDate = new Date(today);
    pastDate.setUTCDate(pastDate.getUTCDate() - 7);

    // Active member (joined in the past, still active)
    const s1 = await createTestStudent();
    await createTestMembership({
      studentId: s1.id,
      groupId: group.id,
      joinDate: pastDate,
    });

    // Left member (joined in the past, left yesterday)
    const s2 = await createTestStudent();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const m2 = await createTestMembership({
      studentId: s2.id,
      groupId: group.id,
      joinDate: pastDate,
    });
    await prisma.groupMembership.update({
      where: { id: m2.id },
      data: { leaveDate: yesterday },
    });

    // Backdate a lesson to today so attendance can be initialized
    const lesson = await prisma.lesson.findFirst({
      where: { groupId: group.id },
      orderBy: { lessonDate: "asc" },
    });

    if (!lesson) return;

    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { lessonDate: today },
    });

    const result = await initializeAttendance({ lessonId: lesson.id });
    expect(result).toEqual({ success: true });

    // Only s1 should have attendance (s2 left yesterday, leaveDate != null)
    const records = await prisma.attendance.findMany({
      where: { lessonId: lesson.id },
    });
    expect(records.length).toBe(1);
    expect(records[0]!.studentId).toBe(s1.id);
  });
});

// ─── C#14: Teacher Rate Required ────────────────────────────────────────────

describe("C#14: teacher rate required", () => {
  it("rejects group creation with rateless teacher", async () => {
    const { createGroup } = await importGroups();

    // Create teacher WITHOUT rate (bypass factory)
    const teacher = await prisma.teacher.create({
      data: {
        firstName: "No",
        lastName: "Rate",
        phone: "+998909999999",
        levels: ["BEGINNER"],
        teachingLanguage: "ANY",
      },
    });

    const result = await createGroup({
      type: "GROUP",
      teacherId: teacher.id,
      days: [1, 3, 5],
      startTime: "14:30",
      durationMinutes: 80,
      level: "BEGINNER",
      maxStudents: 6,
      startDate: "2026-04-01",
      zoomLink: null,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/rate/i);
  });
});

// ─── C#12 / C#12a: Day Pattern & Duration Validation ───────────────────────

describe("C#12/C#12a: group schema validation", () => {
  it("C#12: rejects invalid day pattern [1,2,3]", async () => {
    const { createGroup } = await importGroups();
    const teacher = await createTestTeacher();

    const result = await createGroup({
      type: "GROUP",
      teacherId: teacher.id,
      days: [1, 2, 3],
      startTime: "14:30",
      durationMinutes: 80,
      level: "BEGINNER",
      maxStudents: 6,
      startDate: "2026-04-01",
      zoomLink: null,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/days|mon.*wed.*fri|tue.*thu.*sat/i);
  });

  it("C#12a: rejects invalid duration 90", async () => {
    const { createGroup } = await importGroups();
    const teacher = await createTestTeacher();

    const result = await createGroup({
      type: "GROUP",
      teacherId: teacher.id,
      days: [1, 3, 5],
      startTime: "14:30",
      durationMinutes: 90,
      level: "BEGINNER",
      maxStudents: 6,
      startDate: "2026-04-01",
      zoomLink: null,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/duration|60|80/i);
  });
});
