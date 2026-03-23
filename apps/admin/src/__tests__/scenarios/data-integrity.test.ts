/**
 * Phase 8: Data Integrity — Post-Operation Verification
 *
 * Composite checks run after multi-step operations to verify no orphaned
 * records, no broken FK chains, and paymentStatus consistency.
 *
 * Verifies no orphaned records, no broken FK chains, and paymentStatus consistency.
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
  createTestMembership,
} from "../helpers/factories";

const importGraduation = () => import("@/lib/actions/group-graduation");
const importLessons = () => import("@/lib/actions/lessons");
const importPayments = () => import("@/lib/actions/payments");
const importMemberships = () => import("@/lib/actions/group-memberships");
const importTransfers = () => import("@/lib/actions/transfers");
const importMerge = () => import("@/lib/actions/group-merge");

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

// ─── Helper: mark all lessons as COMPLETED ──────────────────────────────────

async function completeAllLessons(groupId: string) {
  await prisma.lesson.updateMany({
    where: { groupId, status: { in: ["SCHEDULED", "PENDING_RESOLUTION"] } },
    data: { status: "COMPLETED" },
  });
}

// ─── Helper: create committed student via trial → commit ─────────────────────

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

// ─── Transfer Integrity ─────────────────────────────────────────────────────

describe("after transfer", () => {
  it("no orphaned billing periods on source (future months deleted) (C#31)", async () => {
    const { transferStudent } = await importTransfers();

    const { group: source } = await createTestGroup({
      startTime: "14:00",
      startDate: "2026-04-01",
    });
    const { group: dest } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
      startDate: "2026-04-01",
    });

    const { membershipId } = await createCommittedStudent(source.id);

    const transferReason = await prisma.transferReason.findFirst({
      where: { isOther: false },
    });

    await transferStudent({
      membershipId,
      destinationGroupId: dest.id,
      transferReasonId: transferReason!.id,
      otherTransferReason: null,
    });

    // No future billing periods remain on source membership
    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth() + 1;

    const remainingPeriods = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: membershipId },
    });

    for (const p of remainingPeriods) {
      const isFuture =
        p.periodYear > currentYear ||
        (p.periodYear === currentYear && p.periodMonth > currentMonth);
      expect(isFuture).toBe(false);
    }

    // No orphaned AppliedPromotion records pointing to deleted periods
    const allAppliedPromos = await prisma.appliedPromotion.findMany({
      where: {
        studentPaymentPeriod: { groupMembershipId: membershipId },
      },
    });
    // All remaining applied promos should point to existing periods
    const remainingPeriodIds = new Set(remainingPeriods.map((p) => p.id));
    for (const ap of allAppliedPromos) {
      expect(remainingPeriodIds.has(ap.studentPaymentPeriodId)).toBe(true);
    }
  });

  it("no dangling schedule slots (source membership closed)", async () => {
    const { transferStudent } = await importTransfers();

    const { group: source } = await createTestGroup({
      startTime: "14:00",
      startDate: "2026-04-01",
    });
    const { group: dest } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
      startDate: "2026-04-01",
    });

    const { student, membershipId } = await createCommittedStudent(source.id);

    const transferReason = await prisma.transferReason.findFirst({
      where: { isOther: false },
    });

    await transferStudent({
      membershipId,
      destinationGroupId: dest.id,
      transferReasonId: transferReason!.id,
      otherTransferReason: null,
    });

    // Source group's schedule slots still exist (transfer doesn't touch them)
    // but the membership is properly closed
    const closedMembership = await prisma.groupMembership.findUnique({
      where: { id: membershipId },
    });
    expect(closedMembership!.leaveDate).toBeTruthy();

    // Student has new active membership in dest
    const destMembership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: dest.id, leaveDate: null },
    });
    expect(destMembership).toBeTruthy();

    // Dest group has schedule slots for all its lessons
    const destLessons = await prisma.lesson.findMany({
      where: { groupId: dest.id },
    });
    const destSlots = await prisma.teacherScheduleSlot.findMany({
      where: { groupId: dest.id },
    });
    expect(destSlots.length).toBe(destLessons.length);
  });
});

// ─── Merge Integrity ────────────────────────────────────────────────────────

describe("after merge", () => {
  it("source group inactive, all memberships have leaveDate (C#10)", async () => {
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

    await createCommittedStudent(source.id);
    await createCommittedStudent(source.id);

    await mergeGroup({
      sourceGroupId: source.id,
      destinationGroupId: dest.id,
    });

    // Source group inactive
    const sourceGroup = await prisma.group.findUnique({ where: { id: source.id } });
    expect(sourceGroup!.isActive).toBe(false);
    expect(sourceGroup!.mergedIntoGroupId).toBe(dest.id);

    // ALL source memberships have leaveDate (no open memberships)
    const openMemberships = await prisma.groupMembership.findMany({
      where: { groupId: source.id, leaveDate: null },
    });
    expect(openMemberships.length).toBe(0);

    // No orphaned billing periods on source (future periods deleted)
    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth() + 1;

    const sourceMemberships = await prisma.groupMembership.findMany({
      where: { groupId: source.id },
    });
    for (const m of sourceMemberships) {
      const futurePeriods = await prisma.studentPaymentPeriod.findMany({
        where: {
          groupMembershipId: m.id,
          OR: [
            { periodYear: { gt: currentYear } },
            { periodYear: currentYear, periodMonth: { gt: currentMonth } },
          ],
        },
      });
      expect(futurePeriods.length).toBe(0);
    }
  });
});

// ─── Graduation Integrity ───────────────────────────────────────────────────

describe("after graduation", () => {
  it("old group fully closed, new group has complete infrastructure (C#23)", async () => {
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

    // --- Old group integrity ---
    const oldGroup = await prisma.group.findUnique({ where: { id: group.id } });
    expect(oldGroup!.isActive).toBe(false);
    expect(oldGroup!.graduatedIntoGroupId).toBe(result.newGroupId);

    // No open memberships in old group
    const openOldMemberships = await prisma.groupMembership.findMany({
      where: { groupId: group.id, leaveDate: null },
    });
    expect(openOldMemberships.length).toBe(0);

    // --- New group integrity ---
    const newGroup = await prisma.group.findUnique({ where: { id: result.newGroupId } });
    expect(newGroup!.isActive).toBe(true);
    expect(newGroup!.level).toBe("ELEMENTARY");

    // Lessons and schedule slots have 1:1 correspondence
    const newLessons = await prisma.lesson.findMany({
      where: { groupId: result.newGroupId },
    });
    const newSlots = await prisma.teacherScheduleSlot.findMany({
      where: { groupId: result.newGroupId },
    });
    expect(newSlots.length).toBe(newLessons.length);

    // Every lesson has a corresponding slot
    const lessonIds = new Set(newLessons.map((l) => l.id));
    for (const slot of newSlots) {
      expect(lessonIds.has(slot.lessonId)).toBe(true);
    }

    // Teacher history exists for new group
    const newHistory = await prisma.groupTeacherHistory.findMany({
      where: { groupId: result.newGroupId },
    });
    expect(newHistory.length).toBe(1);

    // New memberships link back to old memberships via previousMembershipId
    const newMemberships = await prisma.groupMembership.findMany({
      where: { groupId: result.newGroupId },
    });
    expect(newMemberships.length).toBe(2);
    const oldMembershipIds = (
      await prisma.groupMembership.findMany({
        where: { groupId: group.id },
        select: { id: true },
      })
    ).map((m) => m.id);
    for (const m of newMemberships) {
      expect(m.previousMembershipId).toBeTruthy();
      expect(oldMembershipIds).toContain(m.previousMembershipId);
    }
  });
});

// ─── Lesson Cancellation Integrity ──────────────────────────────────────────

describe("after lesson cancellation", () => {
  it("slot deleted, replacement chain consistent, endDate bumped (C#9)", async () => {
    const { cancelLesson } = await importLessons();
    const { group } = await createTestGroup();

    const reason = await prisma.cancellationReason.findFirst({
      where: { isOther: false },
    });

    // Cancel two lessons to create a chain: A→B, C→D
    const lessons = await prisma.lesson.findMany({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonNumber: "asc" },
      take: 2,
    });

    for (const lesson of lessons) {
      await cancelLesson({
        lessonId: lesson.id,
        cancellationReasonId: reason!.id,
        otherCancellationReason: null,
      });
    }

    // --- Integrity checks ---

    // No schedule slots exist for cancelled lessons
    for (const lesson of lessons) {
      const slot = await prisma.teacherScheduleSlot.findFirst({
        where: { lessonId: lesson.id },
      });
      expect(slot).toBeNull();
    }

    // Each cancelled lesson has exactly one replacement
    for (const lesson of lessons) {
      const replacements = await prisma.lesson.findMany({
        where: { rescheduledFromId: lesson.id },
      });
      expect(replacements.length).toBe(1);
      expect(replacements[0]!.originalLessonId).toBe(lesson.id);
      expect(replacements[0]!.status).toBe("SCHEDULED");
    }

    // Replacements have schedule slots
    const allReplacements = await prisma.lesson.findMany({
      where: { rescheduledFromId: { in: lessons.map((l) => l.id) } },
    });
    for (const replacement of allReplacements) {
      const slot = await prisma.teacherScheduleSlot.findFirst({
        where: { lessonId: replacement.id },
      });
      expect(slot).toBeTruthy();
    }

    // Total original lesson count (excluding replacements) is unchanged
    const originalCount = await prisma.lesson.count({
      where: { groupId: group.id, originalLessonId: null },
    });
    // Factory creates N original lessons. After 2 cancellations, still N originals
    // (replacements are NOT originals — they have originalLessonId set)
    const allLessons = await prisma.lesson.findMany({
      where: { groupId: group.id },
    });
    const originals = allLessons.filter((l) => l.originalLessonId === null);
    const replacementLessons = allLessons.filter((l) => l.originalLessonId !== null);
    expect(originals.length).toBeGreaterThan(0);
    expect(replacementLessons.length).toBe(2);

    // Group endDate >= latest lesson date
    const latestLesson = await prisma.lesson.findFirst({
      where: { groupId: group.id },
      orderBy: { lessonDate: "desc" },
    });
    const updatedGroup = await prisma.group.findUnique({ where: { id: group.id } });
    expect(updatedGroup!.endDate.getTime()).toBeGreaterThanOrEqual(
      latestLesson!.lessonDate.getTime(),
    );
  });
});

// ─── Payment Status Consistency ─────────────────────────────────────────────

describe("paymentStatus consistency", () => {
  it("all periods have status matching amountPaid vs effectiveDue (C#16)", async () => {
    const { graduateGroup } = await importGraduation();
    const { recordPayment } = await importPayments();

    // Set up: graduate a group to create billing periods
    const { group } = await createTestGroup({ level: "BEGINNER" });
    const s1 = await createTestStudent({ status: "ACTIVE", level: "BEGINNER" });
    const s2 = await createTestStudent({ status: "ACTIVE", level: "BEGINNER" });
    const s3 = await createTestStudent({ status: "ACTIVE", level: "BEGINNER" });
    await createTestMembership({ studentId: s1.id, groupId: group.id });
    await createTestMembership({ studentId: s2.id, groupId: group.id });
    await createTestMembership({ studentId: s3.id, groupId: group.id });
    await completeAllLessons(group.id);

    const gradResult = await graduateGroup({
      groupId: group.id,
      studentDecisions: [
        { studentId: s1.id, decision: "CONTINUE" },
        { studentId: s2.id, decision: "CONTINUE" },
        { studentId: s3.id, decision: "CONTINUE" },
      ],
    });
    expect(gradResult).toHaveProperty("success", true);

    // Get billing periods from the new group
    const periods = await prisma.studentPaymentPeriod.findMany({
      where: { groupId: gradResult.newGroupId },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
    expect(periods.length).toBeGreaterThanOrEqual(3); // at least 1 per student

    // Record a partial payment on s1's first period
    const s1Period = periods.find((p) => p.studentId === s1.id);
    expect(s1Period).toBeTruthy();
    const partialAmount = Math.floor(s1Period!.amountDue / 2);
    await recordPayment(s1Period!.id, {
      amount: partialAmount,
      paymentMethod: "cash",
      note: null,
    });

    // Record a full payment on s2's first period
    const s2Period = periods.find((p) => p.studentId === s2.id);
    expect(s2Period).toBeTruthy();
    await recordPayment(s2Period!.id, {
      amount: s2Period!.amountDue - s2Period!.discountAmount,
      paymentMethod: "payme",
      note: null,
    });

    // s3's period stays untouched (UNPAID)

    // --- Global consistency check ---
    const allPeriods = await prisma.studentPaymentPeriod.findMany({
      where: { groupId: gradResult.newGroupId },
    });

    for (const p of allPeriods) {
      const effectiveDue = p.amountDue - p.discountAmount;
      let expectedStatus: string;
      if (p.amountPaid >= effectiveDue) expectedStatus = "PAID";
      else if (p.amountPaid > 0) expectedStatus = "PARTIALLY_PAID";
      else expectedStatus = "UNPAID";

      expect(p.paymentStatus).toBe(expectedStatus);
    }

    // Verify we actually have a mix of statuses (not all UNPAID)
    const statuses = new Set(allPeriods.map((p) => p.paymentStatus));
    expect(statuses.has("UNPAID")).toBe(true);
    expect(statuses.has("PARTIALLY_PAID")).toBe(true);
    expect(statuses.has("PAID")).toBe(true);
  });
});
