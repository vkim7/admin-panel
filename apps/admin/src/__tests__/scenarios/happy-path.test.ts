/**
 * Phase 1: Happy Path — Full Student Lifecycle
 *
 * Tests the core student journey: create → assign (trial) → resolve trial →
 * deactivate → reactivate → reassign. Covers constraints C#1, C#2, C#3, C#7,
 * C#17, C#32.
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
  createTestGroup,
  createTestFamily,
  createTestMembership,
  expectRedirect,
} from "../helpers/factories";
import { TEST_ADMIN_ID } from "../helpers/constants";

// ─── Server Actions (lazy imports to respect vi.mock hoisting) ──────────────
const importStudents = () => import("@/lib/actions/students");
const importMemberships = () => import("@/lib/actions/group-memberships");

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal valid student data for createStudent action. */
function studentData(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Test",
    lastName: "Student",
    phone: `+998${Math.random().toString().slice(2, 11)}`,
    dateOfBirth: "2005-06-15",
    level: "BEGINNER",
    progressStage: "BEGINNING",
    preferredDays: [1, 3, 5],
    preferredTimeSlots: ["14:30"],
    preferredLanguage: "ANY",
    preferredLessonType: "EITHER",
    familyId: null,
    comment: null,
    promoCode: null,
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("student creation", () => {
  it("creates a student with AWAITING_ASSIGNMENT status and auto-generated referralCode", async () => {
    const { createStudent } = await importStudents();
    const phone = "+998901000001";

    const url = await expectRedirect(() =>
      createStudent(studentData({ phone })),
    );

    expect(url).toMatch(/^\/students\//);

    const student = await prisma.student.findUnique({ where: { phone } });
    expect(student).toBeTruthy();
    expect(student!.status).toBe("AWAITING_ASSIGNMENT");
    expect(student!.referralCode).toBeTruthy();
    expect(student!.referralCode!.length).toBe(8);
  });

  it("creates a student with promo code → StudentPromotion attached", async () => {
    const { createStudent } = await importStudents();

    // Create a PROMO_CODE promotion with a code
    const promo = await prisma.promotion.create({
      data: {
        name: "Test Promo",
        type: "PROMO_CODE",
        code: "TESTCODE",
        discountType: "FIXED_AMOUNT",
        discountAmount: 50_000,
        isActive: true,
      },
    });

    const phone = "+998901000002";
    await expectRedirect(() =>
      createStudent(studentData({ phone, promoCode: "TESTCODE" })),
    );

    const student = await prisma.student.findUnique({ where: { phone } });
    const sp = await prisma.studentPromotion.findFirst({
      where: { studentId: student!.id, promotionId: promo.id },
    });
    expect(sp).toBeTruthy();
  });

  it("C#1: rejects duplicate phone number", async () => {
    const { createStudent } = await importStudents();
    const phone = "+998901000003";

    await expectRedirect(() => createStudent(studentData({ phone })));
    const result = await createStudent(studentData({ phone }));

    expect(result).toEqual({
      error: "A student with this phone number already exists",
    });
  });

  it("C#7: rejects minor without familyId", async () => {
    const { createStudent } = await importStudents();

    // dateOfBirth makes the student < 18
    const result = await createStudent(
      studentData({ dateOfBirth: "2015-01-01", familyId: null }),
    );

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/under 18.*family/i);
  });

  it("C#7: accepts minor with familyId", async () => {
    const { createStudent } = await importStudents();
    const family = await createTestFamily();

    const url = await expectRedirect(() =>
      createStudent(
        studentData({ dateOfBirth: "2015-01-01", familyId: family.id }),
      ),
    );

    expect(url).toMatch(/^\/students\//);
  });
});

describe("group assignment (trial)", () => {
  it("C#2/C#3: assigns student to group as trial, status becomes ACTIVE, no billing periods", async () => {
    const { addStudentsToGroup } = await importMemberships();
    const student = await createTestStudent();
    const { group } = await createTestGroup();

    const result = await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    expect(result).toEqual({ success: true });

    // Student should be ACTIVE
    const updated = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(updated!.status).toBe("ACTIVE");

    // Membership should be trial
    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id },
    });
    expect(membership!.isTrial).toBe(true);
    expect(membership!.wasTrialOriginally).toBe(true);

    // No billing periods for trial
    const periods = await prisma.studentPaymentPeriod.count({
      where: { studentId: student.id, groupId: group.id },
    });
    expect(periods).toBe(0);
  });
});

describe("trial resolution", () => {
  it("C#2/C#32: commit → isTrial=false, billing periods created, TRIAL promo applied", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const student = await createTestStudent();
    const { group } = await createTestGroup();

    await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id },
    });

    const result = await resolveTrialMembership(membership!.id, {
      action: "commit",
    });
    expect(result).toEqual({ success: true });

    // isTrial should be false now
    const updated = await prisma.groupMembership.findUnique({
      where: { id: membership!.id },
    });
    expect(updated!.isTrial).toBe(false);

    // Billing periods should exist
    const periods = await prisma.studentPaymentPeriod.count({
      where: { studentId: student.id, groupId: group.id },
    });
    expect(periods).toBeGreaterThan(0);

    // TRIAL promo should be attached
    const trialPromo = await prisma.promotion.findFirst({
      where: { type: "TRIAL", groupTypes: { has: "GROUP" } },
    });
    const sp = await prisma.studentPromotion.findFirst({
      where: { studentId: student.id, promotionId: trialPromo!.id },
    });
    expect(sp).toBeTruthy();
  });

  it("C#2: didn't continue (GROUP) → leaveDate set, no billing, student INACTIVE", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const student = await createTestStudent();
    const { group } = await createTestGroup();

    await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id },
    });

    const result = await resolveTrialMembership(membership!.id, {
      action: "didnt_continue",
    });
    expect(result).toEqual({ success: true });

    // Membership should have leaveDate
    const updatedMembership = await prisma.groupMembership.findUnique({
      where: { id: membership!.id },
    });
    expect(updatedMembership!.leaveDate).toBeTruthy();

    // No billing periods (GROUP trial was free)
    const periods = await prisma.studentPaymentPeriod.count({
      where: { studentId: student.id, groupId: group.id },
    });
    expect(periods).toBe(0);

    // Student should be INACTIVE with lost reason
    const updatedStudent = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(updatedStudent!.status).toBe("INACTIVE");
    expect(updatedStudent!.lostReasonId).toBeTruthy();
  });

  it("C#2: didn't continue (INDIVIDUAL) → bills attended lessons, TRIAL promo attached", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const student = await createTestStudent();
    const { group } = await createTestGroup({
      type: "INDIVIDUAL",
      maxStudents: 1,
    });

    await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id },
    });

    // Simulate attendance for one lesson (mark as present)
    const lesson = await prisma.lesson.findFirst({
      where: { groupId: group.id },
      orderBy: { lessonDate: "asc" },
    });

    if (lesson) {
      await prisma.attendance.create({
        data: {
          lessonId: lesson.id,
          studentId: student.id,
          groupId: group.id,
          isAbsent: false,
        },
      });
    }

    const result = await resolveTrialMembership(membership!.id, {
      action: "didnt_continue",
    });
    expect(result).toEqual({ success: true });

    // Should have billing period(s) for attended lessons
    const periods = await prisma.studentPaymentPeriod.findMany({
      where: { studentId: student.id, groupId: group.id },
    });

    if (lesson) {
      // If there was an attended lesson, billing should exist
      expect(periods.length).toBeGreaterThan(0);
      expect(periods[0]!.totalLessons).toBe(1);
    }

    // TRIAL promo should be attached (INDIVIDUAL type)
    const trialPromo = await prisma.promotion.findFirst({
      where: { type: "TRIAL", groupTypes: { has: "INDIVIDUAL" } },
    });
    if (trialPromo && lesson) {
      const sp = await prisma.studentPromotion.findFirst({
        where: { studentId: student.id, promotionId: trialPromo.id },
      });
      expect(sp).toBeTruthy();
    }

    // Student should be INACTIVE
    const updatedStudent = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(updatedStudent!.status).toBe("INACTIVE");
  });
});

describe("send to lost list & reactivation", () => {
  it("C#17: sends orphan student to lost list with reason", async () => {
    const { sendOrphanToLost } = await importStudents();

    // Create an active student with no memberships
    const student = await createTestStudent({ status: "ACTIVE" });

    const lostReason = await prisma.lostReason.findFirst({
      where: { name: "Too expensive" },
    });

    const result = await sendOrphanToLost(student.id, {
      lostReasonId: lostReason!.id,
      otherLostReason: null,
    });

    expect(result).toEqual({ success: true });

    const updated = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(updated!.status).toBe("INACTIVE");
    expect(updated!.lostReasonId).toBe(lostReason!.id);
    expect(updated!.inactivatedAt).toBeTruthy();
    expect(updated!.inactivatedById).toBe(TEST_ADMIN_ID);
  });

  it("C#17: rejects send to lost if student has active membership", async () => {
    const { sendOrphanToLost } = await importStudents();
    const student = await createTestStudent({ status: "ACTIVE" });
    const { group } = await createTestGroup();

    await createTestMembership({
      studentId: student.id,
      groupId: group.id,
      joinDate: new Date("2026-04-01"),
    });

    const lostReason = await prisma.lostReason.findFirst();
    const result = await sendOrphanToLost(student.id, {
      lostReasonId: lostReason!.id,
      otherLostReason: null,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/active group membership/i);
  });

  it("sends active student to reassignment → AWAITING_REASSIGNMENT", async () => {
    const { sendToReassignment } = await importStudents();
    const student = await createTestStudent({ status: "ACTIVE" });

    const result = await sendToReassignment(student.id);
    expect(result).toEqual({ success: true });

    const updated = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(updated!.status).toBe("AWAITING_REASSIGNMENT");
  });
});

describe("reassignment (non-trial on 2nd attempt)", () => {
  it("C#2: second GROUP assignment → auto-trial=false (trial already used)", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const student = await createTestStudent();
    const { group: group1 } = await createTestGroup({ startDate: "2026-04-01" });
    const { group: group2 } = await createTestGroup({
      startDate: "2026-04-01",
      startTime: "16:00",
      days: [2, 4, 6],
    });

    // First assignment: trial
    await addStudentsToGroup(group1.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const m1 = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group1.id },
    });
    expect(m1!.isTrial).toBe(true);

    // Resolve trial (didn't continue → sets leaveDate)
    await resolveTrialMembership(m1!.id, { action: "didnt_continue" });

    // Reactivate student for reassignment
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

    // Second assignment: still trial (limit is 2 for GROUP)
    await addStudentsToGroup(group2.id, {
      studentIds: [student.id],
      joinDate: "2026-04-02",
      comment: null,
    });

    const m2 = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group2.id },
    });
    expect(m2!.isTrial).toBe(true); // 2nd of 2 allowed

    // Resolve and try a 3rd (should be non-trial)
    await resolveTrialMembership(m2!.id, { action: "didnt_continue" });

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

    const { group: group3 } = await createTestGroup({
      startDate: "2026-04-01",
      startTime: "08:30",
    });

    await addStudentsToGroup(group3.id, {
      studentIds: [student.id],
      joinDate: "2026-04-03",
      comment: null,
    });

    const m3 = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group3.id },
    });
    expect(m3!.isTrial).toBe(false); // 3rd attempt → non-trial
    expect(m3!.wasTrialOriginally).toBe(false);

    // Billing periods should exist (non-trial)
    const periods = await prisma.studentPaymentPeriod.count({
      where: { studentId: student.id, groupId: group3.id },
    });
    expect(periods).toBeGreaterThan(0);
  });
});
