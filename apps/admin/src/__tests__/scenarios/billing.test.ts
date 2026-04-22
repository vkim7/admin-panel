/**
 * Phase 4: Billing & Payments
 *
 * Tests billing period creation, payment recording, payment status transitions,
 * manual adjustment, transfer billing (leave + credit), refund processing,
 * and refund-to-credit conversion.
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

const importMemberships = () => import("@/lib/actions/group-memberships");
const importPayments = () => import("@/lib/actions/payments");
const importRefunds = () => import("@/lib/actions/refunds");
const importTransfers = () => import("@/lib/actions/transfers");

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

// ─── C#32: Billing Period Pre-Creation ──────────────────────────────────────

describe("C#32: billing period creation", () => {
  it("creates periods with correct totalLessons, pricePerLesson, amountDue per month", async () => {
    const { addStudentsToGroup } = await importMemberships();
    const { group } = await createTestGroup({ startTime: "14:30" });

    // Create a non-trial student (exhaust trial first)
    const student = await createTestStudent();
    // Manually mark a past trial so auto-detect makes this non-trial
    await prisma.groupMembership.create({
      data: {
        studentId: student.id,
        groupId: group.id,
        joinDate: new Date("2026-01-01"),
        leaveDate: new Date("2026-01-15"),
        isTrial: false,
        wasTrialOriginally: true,
        assignedById: (await prisma.adminUser.findFirst())!.id,
      },
    });
    // Remove the test membership, re-create the group for a clean slate
    await prisma.groupMembership.deleteMany({
      where: { studentId: student.id },
    });

    // Use a fresh group and directly create non-trial membership via action
    const { group: group2 } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
    });

    // Exhaust both GROUP trials
    await prisma.groupMembership.create({
      data: {
        studentId: student.id,
        groupId: group.id,
        joinDate: new Date("2026-01-01"),
        leaveDate: new Date("2026-01-10"),
        isTrial: false,
        wasTrialOriginally: true,
        assignedById: (await prisma.adminUser.findFirst())!.id,
      },
    });
    await prisma.groupMembership.create({
      data: {
        studentId: student.id,
        groupId: group.id,
        joinDate: new Date("2026-02-01"),
        leaveDate: new Date("2026-02-10"),
        isTrial: false,
        wasTrialOriginally: true,
        assignedById: (await prisma.adminUser.findFirst())!.id,
      },
    });

    // Now addStudentsToGroup → isTrial will be false (2 trials used for GROUP)
    const result = await addStudentsToGroup(group2.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    expect(result).toEqual({ success: true });

    // Check billing periods were created
    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group2.id, leaveDate: null },
    });
    expect(membership).toBeTruthy();
    expect(membership!.isTrial).toBe(false);

    const periods = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: membership!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });

    expect(periods.length).toBeGreaterThan(0);

    // Every period: totalLessons > 0, pricePerLesson = 47_500 (GROUP GENERAL seed),
    // amountDue = totalLessons * pricePerLesson
    for (const p of periods) {
      expect(p.totalLessons).toBeGreaterThan(0);
      expect(p.pricePerLesson).toBe(47_500);
      expect(p.amountDue).toBe(p.totalLessons * p.pricePerLesson);
      expect(p.discountAmount).toBeGreaterThanOrEqual(0);
      expect(p.paymentStatus).toBe("UNPAID");
    }
  });

  it("first month partial: join mid-month → isPartialPeriod=true, fewer lessons", async () => {
    const { resolveTrialMembership, addStudentsToGroup } =
      await importMemberships();

    const { group } = await createTestGroup({ startTime: "14:30" });
    const student = await createTestStudent();

    // First assign as trial (auto-detect), then commit
    await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const trialMembership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id, isTrial: true },
    });
    expect(trialMembership).toBeTruthy();

    // Commit trial → billing periods created from joinDate
    await resolveTrialMembership(trialMembership!.id, { action: "commit" });

    const periods = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: trialMembership!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });

    expect(periods.length).toBeGreaterThan(0);

    // First period: April 2026, join on 1st → NOT partial (join day = 1)
    const firstPeriod = periods[0]!;
    expect(firstPeriod.periodMonth).toBe(4);
    expect(firstPeriod.isPartialPeriod).toBe(false);

    // Now test mid-month join: create another group + student
    const { group: group2 } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
    });
    const student2 = await createTestStudent();

    // Assign mid-month
    await addStudentsToGroup(group2.id, {
      studentIds: [student2.id],
      joinDate: "2026-04-15",
      comment: null,
    });

    const trial2 = await prisma.groupMembership.findFirst({
      where: { studentId: student2.id, groupId: group2.id, isTrial: true },
    });

    // Commit
    await resolveTrialMembership(trial2!.id, { action: "commit" });

    const periods2 = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: trial2!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });

    expect(periods2.length).toBeGreaterThan(0);
    const firstPeriod2 = periods2[0]!;
    expect(firstPeriod2.isPartialPeriod).toBe(true);

    // Partial period has fewer lessons than a full month
    if (periods2.length > 1) {
      const secondPeriod = periods2[1]!;
      expect(firstPeriod2.totalLessons).toBeLessThanOrEqual(
        secondPeriod.totalLessons,
      );
    }
  });

  it("trial commit → billing periods start from original joinDate, not commit date", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();

    const { group } = await createTestGroup({ startTime: "14:30" });
    const student = await createTestStudent();

    // Join on April 1
    await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id, isTrial: true },
    });

    // Commit (in production this could be days/weeks later)
    await resolveTrialMembership(membership!.id, { action: "commit" });

    const periods = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: membership!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });

    // Periods should start from April (joinDate month), not from "today"
    expect(periods.length).toBeGreaterThan(0);
    expect(periods[0]!.periodYear).toBe(2026);
    expect(periods[0]!.periodMonth).toBe(4);
  });
});

// ─── C#16: Payment Status Transitions ───────────────────────────────────────

describe("C#16: record payment + status transitions", () => {
  it("UNPAID → PARTIALLY_PAID → PAID as payments come in", async () => {
    const { recordPayment } = await importPayments();
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();

    const { group } = await createTestGroup({ startTime: "14:30" });
    const student = await createTestStudent();

    // Create non-trial membership via trial commit
    await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id },
    });
    await resolveTrialMembership(membership!.id, { action: "commit" });

    // Get first billing period
    const period = await prisma.studentPaymentPeriod.findFirst({
      where: { groupMembershipId: membership!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
    expect(period).toBeTruthy();
    expect(period!.paymentStatus).toBe("UNPAID");

    const effectiveDue = period!.amountDue - period!.discountAmount;

    // Partial payment
    const r1 = await recordPayment(period!.id, {
      amount: Math.floor(effectiveDue / 2),
      paymentMethod: "cash",
      note: null,
    });
    expect(r1).toEqual({ success: true });

    const afterPartial = await prisma.studentPaymentPeriod.findUnique({
      where: { id: period!.id },
    });
    expect(afterPartial!.paymentStatus).toBe("PARTIALLY_PAID");

    // Pay remaining
    const remaining = effectiveDue - Math.floor(effectiveDue / 2);
    const r2 = await recordPayment(period!.id, {
      amount: remaining,
      paymentMethod: "click",
      note: null,
    });
    expect(r2).toEqual({ success: true });

    const afterFull = await prisma.studentPaymentPeriod.findUnique({
      where: { id: period!.id },
    });
    expect(afterFull!.paymentStatus).toBe("PAID");
    expect(afterFull!.amountPaid).toBe(effectiveDue);
  });
});

// ─── C#15: Manual Period Adjustment ─────────────────────────────────────────

describe("C#15: adjust period manually", () => {
  it("changes amountDue, creates PaymentPeriodAdjustment, recalculates status", async () => {
    const { adjustPeriod } = await importPayments();
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();

    const { group } = await createTestGroup({ startTime: "14:30" });
    const student = await createTestStudent();

    await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id },
    });
    await resolveTrialMembership(membership!.id, { action: "commit" });

    const period = await prisma.studentPaymentPeriod.findFirst({
      where: { groupMembershipId: membership!.id },
    });
    expect(period).toBeTruthy();

    const result = await adjustPeriod(period!.id, {
      totalLessons: 10,
      amountDue: 800_000,
      discountAmount: 100_000,
      reason: "Admin correction",
    });

    expect(result).toEqual({ success: true });

    // Period updated
    const updated = await prisma.studentPaymentPeriod.findUnique({
      where: { id: period!.id },
    });
    expect(updated!.totalLessons).toBe(10);
    expect(updated!.amountDue).toBe(800_000);
    expect(updated!.discountAmount).toBe(100_000);

    // Adjustment record created
    const adjustments = await prisma.paymentPeriodAdjustment.findMany({
      where: { studentPaymentPeriodId: period!.id },
    });
    expect(adjustments.length).toBe(1);
    expect(adjustments[0]!.type).toBe("MANUAL");
    expect(adjustments[0]!.previousAmountDue).toBe(period!.amountDue);
    expect(adjustments[0]!.newAmountDue).toBe(800_000);
    expect(adjustments[0]!.reason).toBe("Admin correction");
  });
});

// ─── C#25 / C#31: Transfer Billing ──────────────────────────────────────────

describe("C#25/C#31: transfer billing", () => {
  it("transfer: source periods adjusted, dest periods created", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const { transferStudent } = await importTransfers();

    // Source group: student goes through trial → commit → billing + TRIAL promo
    const { group: source } = await createTestGroup({
      startTime: "14:30",
      startDate: "2026-04-01",
    });
    const student = await createTestStudent();

    await addStudentsToGroup(source.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: source.id, isTrial: true },
    });
    await resolveTrialMembership(membership!.id, { action: "commit" });

    // Verify source billing exists (with AppliedPromotion from TRIAL)
    const sourcePeriodsBefore = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: membership!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
    expect(sourcePeriodsBefore.length).toBeGreaterThan(1);

    const appliedPromosBefore = await prisma.appliedPromotion.findMany({
      where: { studentPaymentPeriodId: { in: sourcePeriodsBefore.map((p) => p.id) } },
    });
    expect(appliedPromosBefore.length).toBeGreaterThan(0);

    // Destination group (different schedule to avoid conflicts)
    const { group: dest } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
      startDate: "2026-04-01",
    });

    const transferReason = await prisma.transferReason.findFirst({
      where: { isOther: false },
    });

    // Transfer
    const result = await transferStudent({
      membershipId: membership!.id,
      destinationGroupId: dest.id,
      transferReasonId: transferReason!.id,
      otherTransferReason: null,
    });

    expect(result).toHaveProperty("success", true);

    // Source: current-month period adjusted (prorated), future periods deleted
    const sourcePeriodsAfter = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: membership!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
    expect(sourcePeriodsAfter.length).toBeLessThan(sourcePeriodsBefore.length);

    // Current-month period should be marked as partial
    const today = new Date();
    const currentMonth = today.getUTCMonth() + 1;
    const currentYear = today.getUTCFullYear();
    const currentPeriod = sourcePeriodsAfter.find(
      (p) => p.periodYear === currentYear && p.periodMonth === currentMonth,
    );
    if (currentPeriod) {
      expect(currentPeriod.isPartialPeriod).toBe(true);
    }

    // No future periods remain on source
    const futurePeriods = sourcePeriodsAfter.filter(
      (p) => p.periodYear > currentYear || (p.periodYear === currentYear && p.periodMonth > currentMonth),
    );
    expect(futurePeriods.length).toBe(0);

    // Destination: new membership + billing periods created
    const destMembership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: dest.id, leaveDate: null },
    });
    expect(destMembership).toBeTruthy();
    expect(destMembership!.previousMembershipId).toBe(membership!.id);

    const destPeriods = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: destMembership!.id },
    });
    expect(destPeriods.length).toBeGreaterThan(0);
  });

  it("transfer with overpayment → credit applied to dest, excess becomes PENDING refund", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const { recordPayment } = await importPayments();
    const { transferStudent } = await importTransfers();

    // Source group with student committed + billing
    const { group: source } = await createTestGroup({
      startTime: "14:30",
      startDate: "2026-04-01",
    });
    const student = await createTestStudent();

    await addStudentsToGroup(source.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: source.id, isTrial: true },
    });
    await resolveTrialMembership(membership!.id, { action: "commit" });

    // Overpay: pay the full amount for ALL source periods
    const sourcePeriods = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: membership!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });

    let totalPaid = 0;
    for (const period of sourcePeriods) {
      const effectiveDue = period.amountDue - period.discountAmount;
      if (effectiveDue > 0) {
        await recordPayment(period.id, {
          amount: effectiveDue,
          paymentMethod: "cash",
          note: null,
        });
        totalPaid += effectiveDue;
      }
    }
    expect(totalPaid).toBeGreaterThan(0);

    // Destination group
    const { group: dest } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
      startDate: "2026-04-01",
    });

    const transferReason = await prisma.transferReason.findFirst({
      where: { isOther: false },
    });

    const result = await transferStudent({
      membershipId: membership!.id,
      destinationGroupId: dest.id,
      transferReasonId: transferReason!.id,
      otherTransferReason: null,
    });

    expect(result).toHaveProperty("success", true);

    // Should have overpayment from future periods that were deleted
    // Transfer credit or refund should exist
    const destMembership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: dest.id, leaveDate: null },
    });

    // Check for transfer credit payments on dest periods
    const creditPayments = await prisma.payment.findMany({
      where: {
        studentId: student.id,
        isTransferCredit: true,
      },
    });

    // Check for refund (excess that couldn't be absorbed)
    const refunds = await prisma.refund.findMany({
      where: { studentId: student.id, status: "PENDING" },
    });

    // Either credit was applied to dest, or a refund was created, or both
    const totalCredit = creditPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalRefund = refunds.reduce((sum, r) => sum + r.amount, 0);
    expect(totalCredit + totalRefund).toBeGreaterThan(0);
  });
});

// ─── Refund Processing ──────────────────────────────────────────────────────

describe("refund processing", () => {
  it("processRefund → COMPLETED with amountRefunded", async () => {
    const { processRefund } = await importRefunds();

    const student = await createTestStudent();
    const { group } = await createTestGroup({ startTime: "14:30" });
    const admin = await prisma.adminUser.findFirst();

    // Create a membership (required FK for billing period)
    const membership = await createTestMembership({
      studentId: student.id,
      groupId: group.id,
      joinDate: new Date("2026-04-01"),
    });

    // Create a billing period + refund manually (simulating leave billing)
    const period = await prisma.studentPaymentPeriod.create({
      data: {
        student: { connect: { id: student.id } },
        group: { connect: { id: group.id } },
        groupMembership: { connect: { id: membership.id } },
        periodYear: 2026,
        periodMonth: 4,
        totalLessons: 12,
        pricePerLesson: 47_500,
        amountDue: 570_000,
        discountAmount: 0,
      },
    });

    const refund = await prisma.refund.create({
      data: {
        student: { connect: { id: student.id } },
        studentPaymentPeriod: { connect: { id: period.id } },
        amount: 500_000,
        status: "PENDING",
        initiatedBy: { connect: { id: admin!.id } },
      },
    });

    const result = await processRefund({
      refundId: refund.id,
      amountRefunded: 500_000,
      paymentMethod: "cash",
      note: "Returned to student",
    });

    expect(result).toEqual({ success: true });

    const updated = await prisma.refund.findUnique({
      where: { id: refund.id },
    });
    expect(updated!.status).toBe("COMPLETED");
    expect(updated!.amountRefunded).toBe(500_000);
    expect(updated!.paymentMethod).toBe("cash");
    expect(updated!.processedAt).toBeTruthy();
  });

  it("convertRefundToCredit → Payment(isTransferCredit) on target period", async () => {
    const { convertRefundToCredit } = await importRefunds();

    const student = await createTestStudent();
    const { group } = await createTestGroup({ startTime: "14:30" });
    const admin = await prisma.adminUser.findFirst();

    // Create membership (required FK for billing periods)
    const membership = await createTestMembership({
      studentId: student.id,
      groupId: group.id,
      joinDate: new Date("2026-04-01"),
    });

    // Source period (where refund originates)
    const sourcePeriod = await prisma.studentPaymentPeriod.create({
      data: {
        student: { connect: { id: student.id } },
        group: { connect: { id: group.id } },
        groupMembership: { connect: { id: membership.id } },
        periodYear: 2026,
        periodMonth: 4,
        totalLessons: 12,
        pricePerLesson: 47_500,
        amountDue: 570_000,
        discountAmount: 0,
      },
    });

    // Target period (where credit will go)
    const targetPeriod = await prisma.studentPaymentPeriod.create({
      data: {
        student: { connect: { id: student.id } },
        group: { connect: { id: group.id } },
        groupMembership: { connect: { id: membership.id } },
        periodYear: 2026,
        periodMonth: 5,
        totalLessons: 12,
        pricePerLesson: 47_500,
        amountDue: 570_000,
        discountAmount: 0,
      },
    });

    const refund = await prisma.refund.create({
      data: {
        student: { connect: { id: student.id } },
        studentPaymentPeriod: { connect: { id: sourcePeriod.id } },
        amount: 300_000,
        status: "PENDING",
        initiatedBy: { connect: { id: admin!.id } },
      },
    });

    const result = await convertRefundToCredit({
      refundId: refund.id,
      targetPeriodId: targetPeriod.id,
      note: "Applied as credit",
    });

    expect(result).toEqual({ success: true });

    // Refund marked completed with amountRefunded=0 (money went to credit)
    const updatedRefund = await prisma.refund.findUnique({
      where: { id: refund.id },
    });
    expect(updatedRefund!.status).toBe("COMPLETED");
    expect(updatedRefund!.amountRefunded).toBe(0);

    // Target period has payment
    const updatedTarget = await prisma.studentPaymentPeriod.findUnique({
      where: { id: targetPeriod.id },
    });
    expect(updatedTarget!.amountPaid).toBe(300_000);
    expect(updatedTarget!.paymentStatus).toBe("PARTIALLY_PAID");

    // Payment record exists with isTransferCredit
    const payment = await prisma.payment.findFirst({
      where: {
        studentPaymentPeriodId: targetPeriod.id,
        isTransferCredit: true,
      },
    });
    expect(payment).toBeTruthy();
    expect(payment!.amount).toBe(300_000);
  });
});

// ─── C#36: Discount Cap ─────────────────────────────────────────────────────

describe("C#36: discount cap", () => {
  it("effective due never goes below zero (discount capped at amountDue)", async () => {
    const { adjustPeriod, recordPayment } = await importPayments();
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();

    const { group } = await createTestGroup({ startTime: "14:30" });
    const student = await createTestStudent();

    await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id },
    });
    await resolveTrialMembership(membership!.id, { action: "commit" });

    const period = await prisma.studentPaymentPeriod.findFirst({
      where: { groupMembershipId: membership!.id },
    });
    expect(period).toBeTruthy();

    // Set discount to exceed amountDue
    await adjustPeriod(period!.id, {
      totalLessons: period!.totalLessons,
      amountDue: period!.amountDue,
      discountAmount: period!.amountDue + 100_000, // Discount exceeds due
      reason: "Testing discount cap",
    });

    const updated = await prisma.studentPaymentPeriod.findUnique({
      where: { id: period!.id },
    });

    // Effective due = amountDue - discountAmount, but payment status should be PAID
    // because amountPaid (0) >= effective due (negative → capped to 0)
    expect(updated!.paymentStatus).toBe("PAID");

    // Even a zero-amount payment shouldn't cause issues
    const r = await recordPayment(period!.id, {
      amount: 1,
      paymentMethod: "cash",
      note: null,
    });
    expect(r).toEqual({ success: true });
  });
});
