/**
 * Phase 7: Group Lifecycle — Graduation & Merge
 *
 * Tests group graduation (level progression, student decisions, successor group
 * creation) and group merge (validation, student movement, billing adjustments).
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
} from "../helpers/factories";

const importGraduation = () => import("@/lib/actions/group-graduation");
const importMerge = () => import("@/lib/actions/group-merge");
const importMemberships = () => import("@/lib/actions/group-memberships");
const importPayments = () => import("@/lib/actions/payments");

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

// ─── Helper: mark all lessons as COMPLETED (bypasses completeLesson action) ──

async function completeAllLessons(groupId: string) {
  await prisma.lesson.updateMany({
    where: { groupId, status: { in: ["SCHEDULED", "PENDING_RESOLUTION"] } },
    data: { status: "COMPLETED" },
  });
}

// ─── Graduation: Eligibility Checks ─────────────────────────────────────────

describe("graduation eligibility", () => {
  it("IELTS group → error (C#24)", async () => {
    const { graduateGroup } = await importGraduation();
    const { group } = await createTestGroup({ level: "IELTS" });
    const student = await createTestStudent({ status: "ACTIVE", level: "IELTS" });
    await createTestMembership({ studentId: student.id, groupId: group.id });

    const result = await graduateGroup({
      groupId: group.id,
      studentDecisions: [{ studentId: student.id, decision: "CONTINUE" }],
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/IELTS.*cannot graduate/i);
  });

  it("skipAutoGraduation=true → error (C#23)", async () => {
    const { graduateGroup } = await importGraduation();
    const { group } = await createTestGroup({ level: "BEGINNER" });
    await prisma.group.update({
      where: { id: group.id },
      data: { skipAutoGraduation: true },
    });
    const student = await createTestStudent({ status: "ACTIVE" });
    await createTestMembership({ studentId: student.id, groupId: group.id });

    const result = await graduateGroup({
      groupId: group.id,
      studentDecisions: [{ studentId: student.id, decision: "CONTINUE" }],
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/auto-graduation.*disabled/i);
  });

  it("SCHEDULED lessons remaining → error (C#23)", async () => {
    const { graduateGroup } = await importGraduation();
    const { group } = await createTestGroup({ level: "BEGINNER" });
    const student = await createTestStudent({ status: "ACTIVE" });
    await createTestMembership({ studentId: student.id, groupId: group.id });
    // Lessons are still SCHEDULED — don't complete them

    const result = await graduateGroup({
      groupId: group.id,
      studentDecisions: [{ studentId: student.id, decision: "CONTINUE" }],
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/lessons.*completed.*cancelled/i);
  });

  it("DEACTIVATE without lostReasonId → error (C#17)", async () => {
    const { graduateGroup } = await importGraduation();
    const { group } = await createTestGroup({ level: "BEGINNER" });
    const student = await createTestStudent({ status: "ACTIVE" });
    await createTestMembership({ studentId: student.id, groupId: group.id });

    const result = await graduateGroup({
      groupId: group.id,
      studentDecisions: [{ studentId: student.id, decision: "DEACTIVATE" }],
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/lost reason/i);
  });
});

// ─── Graduation: Successful Flow ────────────────────────────────────────────

describe("graduation flow", () => {
  it("eligible group → next-level group created (C#23, C#24)", async () => {
    const { graduateGroup } = await importGraduation();
    const { group, teacher } = await createTestGroup({
      level: "PRE_INTERMEDIATE",
      days: [1, 3, 5],
      startTime: "14:00",
    });
    const student = await createTestStudent({ status: "ACTIVE", level: "PRE_INTERMEDIATE" });
    await createTestMembership({ studentId: student.id, groupId: group.id });
    await completeAllLessons(group.id);

    const result = await graduateGroup({
      groupId: group.id,
      studentDecisions: [{ studentId: student.id, decision: "CONTINUE" }],
    });

    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("newGroupId");

    // New group at next level with same teacher/schedule
    const newGroup = await prisma.group.findUnique({
      where: { id: result.newGroupId },
    });
    expect(newGroup).toBeTruthy();
    expect(newGroup!.level).toBe("INTERMEDIATE");
    expect(newGroup!.teacherId).toBe(teacher.id);
    expect(newGroup!.days).toEqual([1, 3, 5]);
    expect(newGroup!.startTime).toBe("14:00");
    expect(newGroup!.isActive).toBe(true);

    // New group has lessons + schedule slots + teacher history
    const lessons = await prisma.lesson.findMany({
      where: { groupId: result.newGroupId },
    });
    expect(lessons.length).toBeGreaterThan(0);

    const slots = await prisma.teacherScheduleSlot.findMany({
      where: { groupId: result.newGroupId },
    });
    expect(slots.length).toBe(lessons.length);

    const history = await prisma.groupTeacherHistory.findMany({
      where: { groupId: result.newGroupId },
    });
    expect(history.length).toBe(1);
    expect(history[0]!.teacherId).toBe(teacher.id);

    // Old group deactivated with pointer to new group
    const oldGroup = await prisma.group.findUnique({
      where: { id: group.id },
    });
    expect(oldGroup!.isActive).toBe(false);
    expect(oldGroup!.graduatedIntoGroupId).toBe(result.newGroupId);
  });

  it("continuing students: new membership + billing + level updated (C#23, C#32, C#33)", async () => {
    const { graduateGroup } = await importGraduation();
    const { group } = await createTestGroup({ level: "BEGINNER" });
    const s1 = await createTestStudent({ status: "ACTIVE", level: "BEGINNER" });
    const s2 = await createTestStudent({ status: "ACTIVE", level: "BEGINNER" });
    await createTestMembership({ studentId: s1.id, groupId: group.id });
    await createTestMembership({ studentId: s2.id, groupId: group.id });
    await completeAllLessons(group.id);

    const result = await graduateGroup({
      groupId: group.id,
      studentDecisions: [
        { studentId: s1.id, decision: "CONTINUE" },
        { studentId: s2.id, decision: "CONTINUE" },
      ],
    });

    expect(result).toHaveProperty("success", true);
    expect(result.continuingCount).toBe(2);

    // New memberships in successor group
    const newMemberships = await prisma.groupMembership.findMany({
      where: { groupId: result.newGroupId },
    });
    expect(newMemberships.length).toBe(2);
    expect(newMemberships.every((m) => !m.isTrial)).toBe(true);

    // previousMembershipId links back to old membership
    for (const m of newMemberships) {
      expect(m.previousMembershipId).toBeTruthy();
    }

    // Billing periods created for each continuing student
    for (const m of newMemberships) {
      const periods = await prisma.studentPaymentPeriod.findMany({
        where: { groupMembershipId: m.id },
      });
      expect(periods.length).toBeGreaterThan(0);
    }

    // Student levels updated to ELEMENTARY (C#33)
    const updatedS1 = await prisma.student.findUnique({ where: { id: s1.id } });
    const updatedS2 = await prisma.student.findUnique({ where: { id: s2.id } });
    expect(updatedS1!.level).toBe("ELEMENTARY");
    expect(updatedS2!.level).toBe("ELEMENTARY");
  });

  it("leaveDate on old memberships + REASSIGN/DEACTIVATE decisions (C#23, C#17)", async () => {
    const { graduateGroup } = await importGraduation();
    const { group } = await createTestGroup({ level: "BEGINNER" });
    const sContinue = await createTestStudent({ status: "ACTIVE", level: "BEGINNER" });
    const sReassign = await createTestStudent({ status: "ACTIVE", level: "BEGINNER" });
    const sDeactivate = await createTestStudent({ status: "ACTIVE", level: "BEGINNER" });
    await createTestMembership({ studentId: sContinue.id, groupId: group.id });
    await createTestMembership({ studentId: sReassign.id, groupId: group.id });
    await createTestMembership({ studentId: sDeactivate.id, groupId: group.id });
    await completeAllLessons(group.id);

    const lostReason = await prisma.lostReason.findFirst({
      where: { isOther: false, isActive: true },
    });

    const result = await graduateGroup({
      groupId: group.id,
      studentDecisions: [
        { studentId: sContinue.id, decision: "CONTINUE" },
        { studentId: sReassign.id, decision: "REASSIGN" },
        { studentId: sDeactivate.id, decision: "DEACTIVATE", lostReasonId: lostReason!.id },
      ],
    });

    expect(result).toHaveProperty("success", true);

    // All old memberships get leaveDate
    const oldMemberships = await prisma.groupMembership.findMany({
      where: { groupId: group.id },
    });
    expect(oldMemberships.length).toBe(3);
    for (const m of oldMemberships) {
      expect(m.leaveDate).toBeTruthy();
    }

    // REASSIGN → AWAITING_REASSIGNMENT
    const updatedReassign = await prisma.student.findUnique({ where: { id: sReassign.id } });
    expect(updatedReassign!.status).toBe("AWAITING_REASSIGNMENT");

    // DEACTIVATE → INACTIVE + lostReason + timestamp
    const updatedDeactivate = await prisma.student.findUnique({ where: { id: sDeactivate.id } });
    expect(updatedDeactivate!.status).toBe("INACTIVE");
    expect(updatedDeactivate!.lostReasonId).toBe(lostReason!.id);
    expect(updatedDeactivate!.inactivatedAt).toBeTruthy();
  });
});

// ─── Merge: Validation ──────────────────────────────────────────────────────

describe("merge validation", () => {
  it("different levels → error (C#10)", async () => {
    const { mergeGroup } = await importMerge();
    const { group: source } = await createTestGroup({
      level: "BEGINNER",
      startTime: "14:00",
    });
    const { group: dest } = await createTestGroup({
      level: "ELEMENTARY",
      startTime: "16:00",
    });
    const student = await createTestStudent({ status: "ACTIVE" });
    await createTestMembership({ studentId: student.id, groupId: source.id });

    const result = await mergeGroup({
      sourceGroupId: source.id,
      destinationGroupId: dest.id,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/same level/i);
  });

  it("source has unresolved trials → error (C#2)", async () => {
    const { mergeGroup } = await importMerge();
    const { group: source } = await createTestGroup({
      level: "BEGINNER",
      startTime: "14:00",
    });
    const { group: dest } = await createTestGroup({
      level: "BEGINNER",
      startTime: "16:00",
    });
    const student = await createTestStudent({ status: "ACTIVE" });
    await createTestMembership({
      studentId: student.id,
      groupId: source.id,
      isTrial: true,
    });

    const result = await mergeGroup({
      sourceGroupId: source.id,
      destinationGroupId: dest.id,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/unresolved trial/i);
  });

  it("destination capacity exceeded → error (C#3)", async () => {
    const { mergeGroup } = await importMerge();
    const { group: source } = await createTestGroup({
      level: "BEGINNER",
      startTime: "14:00",
    });
    const { group: dest } = await createTestGroup({
      level: "BEGINNER",
      maxStudents: 2,
      startTime: "16:00",
    });

    // 3 non-trial students in source exceeds dest capacity of 2
    for (let i = 0; i < 3; i++) {
      const student = await createTestStudent({ status: "ACTIVE" });
      await createTestMembership({ studentId: student.id, groupId: source.id });
    }

    const result = await mergeGroup({
      sourceGroupId: source.id,
      destinationGroupId: dest.id,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/cannot accommodate/i);
  });
});

// ─── Merge: Execution ───────────────────────────────────────────────────────

describe("merge execution", () => {
  /** Helper: create a committed student in a group via trial → commit flow. */
  async function createCommittedStudent(groupId: string) {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const student = await createTestStudent();
    await addStudentsToGroup(groupId, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId, isTrial: true },
    });
    await resolveTrialMembership(membership!.id, { action: "commit" });
    return { student, membershipId: membership!.id };
  }

  it("source students move to dest, leave billing on source, new billing on dest (C#10, C#31, C#32)", async () => {
    const { mergeGroup } = await importMerge();

    const { group: source } = await createTestGroup({
      level: "BEGINNER",
      startTime: "14:00",
      startDate: "2026-04-01",
    });
    const { group: dest } = await createTestGroup({
      level: "BEGINNER",
      startTime: "16:00",
      days: [2, 4, 6],
      startDate: "2026-04-01",
    });

    const { student: s1, membershipId: m1Id } = await createCommittedStudent(source.id);
    const { student: s2, membershipId: m2Id } = await createCommittedStudent(source.id);

    // Verify source billing exists before merge
    const sourcePeriodsBeforeS1 = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: m1Id },
    });
    expect(sourcePeriodsBeforeS1.length).toBeGreaterThan(0);

    const result = await mergeGroup({
      sourceGroupId: source.id,
      destinationGroupId: dest.id,
    });

    expect(result).toHaveProperty("success", true);
    expect(result.movedCount).toBe(2);

    // Source memberships closed
    const sourceMemberships = await prisma.groupMembership.findMany({
      where: { groupId: source.id },
    });
    for (const m of sourceMemberships) {
      expect(m.leaveDate).toBeTruthy();
    }

    // Source group deactivated with mergedIntoGroupId
    const sourceGroup = await prisma.group.findUnique({ where: { id: source.id } });
    expect(sourceGroup!.isActive).toBe(false);
    expect(sourceGroup!.mergedIntoGroupId).toBe(dest.id);

    // Destination: new memberships created for both students
    const destMemberships = await prisma.groupMembership.findMany({
      where: { groupId: dest.id, leaveDate: null },
    });
    expect(destMemberships.length).toBe(2);

    // Destination billing periods exist
    for (const m of destMemberships) {
      const periods = await prisma.studentPaymentPeriod.findMany({
        where: { groupMembershipId: m.id },
      });
      expect(periods.length).toBeGreaterThan(0);
    }
  });

  it("transfer credits applied to dest periods (C#25)", async () => {
    const { mergeGroup } = await importMerge();
    const { recordPayment } = await importPayments();

    const { group: source } = await createTestGroup({
      level: "BEGINNER",
      startTime: "14:00",
      startDate: "2026-04-01",
    });
    const { group: dest } = await createTestGroup({
      level: "BEGINNER",
      startTime: "16:00",
      days: [2, 4, 6],
      startDate: "2026-04-01",
    });

    const { student, membershipId } = await createCommittedStudent(source.id);

    // Overpay all source periods to guarantee overpayment on merge
    const sourcePeriods = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: membershipId },
    });
    for (const period of sourcePeriods) {
      const effectiveDue = period.amountDue - period.discountAmount;
      if (effectiveDue > 0) {
        await recordPayment(period.id, {
          amount: effectiveDue,
          paymentMethod: "cash",
          note: null,
        });
      }
    }

    const result = await mergeGroup({
      sourceGroupId: source.id,
      destinationGroupId: dest.id,
    });
    expect(result).toHaveProperty("success", true);

    // Transfer credit or refund should exist
    const creditPayments = await prisma.payment.findMany({
      where: { studentId: student.id, isTransferCredit: true },
    });
    const refunds = await prisma.refund.findMany({
      where: { studentId: student.id, status: "PENDING" },
    });

    const totalCredit = creditPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalRefund = refunds.reduce((sum, r) => sum + r.amount, 0);
    expect(totalCredit + totalRefund).toBeGreaterThan(0);
  });

  it("merge INDIVIDUAL groups (C#22)", async () => {
    const { mergeGroup } = await importMerge();

    const { group: source } = await createTestGroup({
      type: "INDIVIDUAL",
      level: "BEGINNER",
      maxStudents: 1,
      startTime: "14:00",
      startDate: "2026-04-01",
    });
    const { group: dest } = await createTestGroup({
      type: "INDIVIDUAL",
      level: "BEGINNER",
      maxStudents: 2,
      startTime: "16:00",
      days: [2, 4, 6],
      startDate: "2026-04-01",
    });

    const { student } = await createCommittedStudent(source.id);

    const result = await mergeGroup({
      sourceGroupId: source.id,
      destinationGroupId: dest.id,
    });

    expect(result).toHaveProperty("success", true);

    // Student moved to dest
    const destMembership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: dest.id, leaveDate: null },
    });
    expect(destMembership).toBeTruthy();

    // Source deactivated
    const sourceGroup = await prisma.group.findUnique({ where: { id: source.id } });
    expect(sourceGroup!.isActive).toBe(false);
    expect(sourceGroup!.mergedIntoGroupId).toBe(dest.id);
  });
});
