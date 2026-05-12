/**
 * Phase 5: Promotions — Auto-Detection & Application
 *
 * Tests TRIAL, WIN_BACK, SEASONAL, FAMILY, and REFERRAL promotions:
 * auto-detection triggers, discount application to billing periods,
 * family lifecycle (add/remove), and referral completion flow.
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
  expectRedirect,
} from "../helpers/factories";

const importMemberships = () => import("@/lib/actions/group-memberships");
const importStudents = () => import("@/lib/actions/students");
const importPayments = () => import("@/lib/actions/payments");
const importReferrals = () => import("@/lib/actions/referrals");

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

// ─── Helper: valid student data for createStudent / updateStudent ────────────

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
    referredByCode: null,
    ...overrides,
  };
}

// ─── TRIAL Promo ────────────────────────────────────────────────────────────

describe("TRIAL promo: auto-attach on commit", () => {
  it("GROUP commit → TRIAL 100% off 1 lesson applied to first period", async () => {
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
      where: { studentId: student.id, groupId: group.id, isTrial: true },
    });
    expect(membership).toBeTruthy();

    await resolveTrialMembership(membership!.id, { action: "commit" });

    // TRIAL StudentPromotion created
    const trialPromo = await prisma.promotion.findFirst({
      where: { type: "TRIAL", groupTypes: { has: "GROUP" } },
    });
    const sp = await prisma.studentPromotion.findFirst({
      where: { studentId: student.id, promotionId: trialPromo!.id },
    });
    expect(sp).toBeTruthy();

    // AppliedPromotion on first period only (non-recurring, maxUsesPerStudent=1)
    const periods = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: membership!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
    expect(periods.length).toBeGreaterThan(1);

    const firstPeriod = periods[0]!;
    const applied = await prisma.appliedPromotion.findMany({
      where: { studentPaymentPeriodId: firstPeriod.id, studentPromotionId: sp!.id },
    });
    expect(applied.length).toBe(1);

    // GROUP TRIAL = 100% of pricePerLesson (one lesson free)
    expect(applied[0]!.discountAmount).toBe(firstPeriod.pricePerLesson);

    // First period discountAmount matches
    expect(firstPeriod.discountAmount).toBeGreaterThanOrEqual(applied[0]!.discountAmount);

    // Second period should NOT have TRIAL discount (non-recurring)
    const secondApplied = await prisma.appliedPromotion.findMany({
      where: { studentPaymentPeriodId: periods[1]!.id, studentPromotionId: sp!.id },
    });
    expect(secondApplied.length).toBe(0);
  });

  it("INDIVIDUAL commit → TRIAL 50% off 1 lesson", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();

    const { group } = await createTestGroup({
      type: "INDIVIDUAL",
      maxStudents: 1,
      startTime: "14:30",
    });
    const student = await createTestStudent();

    await addStudentsToGroup(group.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id, isTrial: true },
    });
    await resolveTrialMembership(membership!.id, { action: "commit" });

    // TRIAL INDIVIDUAL promo = 50%
    const trialPromo = await prisma.promotion.findFirst({
      where: { type: "TRIAL", groupTypes: { has: "INDIVIDUAL" } },
    });
    const sp = await prisma.studentPromotion.findFirst({
      where: { studentId: student.id, promotionId: trialPromo!.id },
    });
    expect(sp).toBeTruthy();

    const firstPeriod = await prisma.studentPaymentPeriod.findFirst({
      where: { groupMembershipId: membership!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
    expect(firstPeriod).toBeTruthy();

    const applied = await prisma.appliedPromotion.findFirst({
      where: { studentPaymentPeriodId: firstPeriod!.id, studentPromotionId: sp!.id },
    });
    expect(applied).toBeTruthy();

    // 50% of pricePerLesson
    expect(applied!.discountAmount).toBe(
      Math.floor(firstPeriod!.pricePerLesson * 0.5),
    );
  });
});

// ─── WIN_BACK Promo ─────────────────────────────────────────────────────────

describe("WIN_BACK: inactive student rejoins", () => {
  it("student from Lost List → WIN_BACK promo auto-attached on re-assignment", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();

    const student = await createTestStudent();
    const { group: group1 } = await createTestGroup({ startTime: "14:30" });

    // Assign trial → didn't continue → INACTIVE with lostReasonId
    await addStudentsToGroup(group1.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const m1 = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group1.id },
    });
    await resolveTrialMembership(m1!.id, { action: "didnt_continue" });

    // Verify student is INACTIVE with lostReasonId
    const inactive = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(inactive!.status).toBe("INACTIVE");
    expect(inactive!.lostReasonId).toBeTruthy();

    // Re-assign while INACTIVE → detectWinBack fires
    const { group: group2 } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
    });

    await addStudentsToGroup(group2.id, {
      studentIds: [student.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    // WIN_BACK StudentPromotion should exist
    const winBackPromo = await prisma.promotion.findFirst({
      where: { type: "WIN_BACK", isActive: true },
    });
    const sp = await prisma.studentPromotion.findFirst({
      where: { studentId: student.id, promotionId: winBackPromo!.id },
    });
    expect(sp).toBeTruthy();
  });
});

// ─── SEASONAL Promo ──────────────────────────────────────────────────────────

describe("SEASONAL: campaign window detection", () => {
  it("active campaign → promo attached at student creation", async () => {
    const { createStudent } = await importStudents();

    // Create a SEASONAL promotion with current date in campaign window
    const now = new Date();
    const validFrom = new Date(now);
    validFrom.setUTCDate(validFrom.getUTCDate() - 1);
    const validTo = new Date(now);
    validTo.setUTCDate(validTo.getUTCDate() + 30);

    const seasonal = await prisma.promotion.create({
      data: {
        name: "Test Spring Campaign",
        type: "SEASONAL",
        discountType: "FIXED_AMOUNT",
        discountAmount: 200_000,
        isRecurring: false,
        maxUsesPerStudent: 1,
        isActive: true,
        validFrom,
        validTo,
      },
    });

    const phone = `+998${Math.random().toString().slice(2, 11)}`;
    await expectRedirect(() => createStudent(studentData({ phone })));

    const student = await prisma.student.findUnique({ where: { phone } });
    expect(student).toBeTruthy();

    // SEASONAL StudentPromotion should be attached
    const sp = await prisma.studentPromotion.findFirst({
      where: { studentId: student!.id, promotionId: seasonal.id },
    });
    expect(sp).toBeTruthy();
  });
});

// ─── FAMILY Promo ───────────────────────────────────────────────────────────

describe("FAMILY: auto-detection & removal", () => {
  it("2nd active family member → FAMILY promo auto-attached to both, discount on existing member periods", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();

    const family = await createTestFamily();
    const studentA = await createTestStudent({ familyId: family.id });
    const studentB = await createTestStudent({ familyId: family.id });

    // A: assign → commit → ACTIVE with billing periods
    const { group: groupA } = await createTestGroup({ startTime: "14:30" });

    await addStudentsToGroup(groupA.id, {
      studentIds: [studentA.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const mA = await prisma.groupMembership.findFirst({
      where: { studentId: studentA.id, groupId: groupA.id },
    });
    await resolveTrialMembership(mA!.id, { action: "commit" });

    // A should NOT have FAMILY promo yet (only 1 active family member)
    const familyPromo = await prisma.promotion.findFirst({
      where: { type: "FAMILY", isActive: true },
    });
    const spBefore = await prisma.studentPromotion.findFirst({
      where: { studentId: studentA.id, promotionId: familyPromo!.id },
    });
    expect(spBefore).toBeNull();

    // B: assign → triggers detectFamily (A=ACTIVE + B about to be activated)
    const { group: groupB } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
    });

    await addStudentsToGroup(groupB.id, {
      studentIds: [studentB.id],
      joinDate: "2026-04-01",
      comment: null,
    });

    // Both should have FAMILY StudentPromotion
    const spA = await prisma.studentPromotion.findFirst({
      where: { studentId: studentA.id, promotionId: familyPromo!.id },
    });
    const spB = await prisma.studentPromotion.findFirst({
      where: { studentId: studentB.id, promotionId: familyPromo!.id },
    });
    expect(spA).toBeTruthy();
    expect(spB).toBeTruthy();

    // A's future billing periods should have FAMILY discount applied
    const aPeriods = await prisma.studentPaymentPeriod.findMany({
      where: { groupMembershipId: mA!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });

    // At least one period should have discountAmount > 0 from FAMILY
    const aApplied = await prisma.appliedPromotion.findMany({
      where: { studentPromotionId: spA!.id },
    });
    expect(aApplied.length).toBeGreaterThan(0);

    // Discount = 70_000 per period (FAMILY is FIXED_AMOUNT 70K, recurring)
    expect(aApplied[0]!.discountAmount).toBe(70_000);
  });

  it("family drops below 2 active → FAMILY promo expired, removed from future periods", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const { sendOrphanToLost } = await importStudents();

    const family = await createTestFamily();
    const studentA = await createTestStudent({ familyId: family.id });
    const studentB = await createTestStudent({ familyId: family.id });

    // A: assign → commit
    const { group: groupA } = await createTestGroup({ startTime: "14:30" });
    await addStudentsToGroup(groupA.id, {
      studentIds: [studentA.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const mA = await prisma.groupMembership.findFirst({
      where: { studentId: studentA.id, groupId: groupA.id },
    });
    await resolveTrialMembership(mA!.id, { action: "commit" });

    // B: assign → commit (need separate group to avoid schedule conflict)
    const { group: groupB } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
    });
    await addStudentsToGroup(groupB.id, {
      studentIds: [studentB.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const mB = await prisma.groupMembership.findFirst({
      where: { studentId: studentB.id, groupId: groupB.id },
    });
    await resolveTrialMembership(mB!.id, { action: "commit" });

    // Verify both have FAMILY promo
    const familyPromo = await prisma.promotion.findFirst({
      where: { type: "FAMILY", isActive: true },
    });
    const spA = await prisma.studentPromotion.findFirst({
      where: { studentId: studentA.id, promotionId: familyPromo!.id },
    });
    expect(spA).toBeTruthy();

    // Record A's discountAmount on a future period before removal
    const aPeriodBefore = await prisma.studentPaymentPeriod.findFirst({
      where: { groupMembershipId: mA!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
    const discountBefore = aPeriodBefore!.discountAmount;

    // Close B's membership (required before send to lost)
    await prisma.groupMembership.update({
      where: { id: mB!.id },
      data: { leaveDate: new Date() },
    });

    // Send B to lost list → removeFamilyIfNeeded fires
    const lostReason = await prisma.lostReason.findFirst({
      where: { isOther: false },
    });
    await sendOrphanToLost(studentB.id, {
      lostReasonId: lostReason!.id,
      otherLostReason: null,
    });

    // A's FAMILY StudentPromotion should be expired
    const spAAfter = await prisma.studentPromotion.findUnique({
      where: { id: spA!.id },
    });
    expect(spAAfter!.expiresAt).toBeTruthy();

    // A's future period FAMILY AppliedPromotions should be removed
    const aAppliedAfter = await prisma.appliedPromotion.findMany({
      where: { studentPromotionId: spA!.id },
    });
    // All future period applied promotions should be gone (all periods are April+ = future)
    expect(aAppliedAfter.length).toBe(0);

    // A's future period discountAmount should be reduced
    const aPeriodAfter = await prisma.studentPaymentPeriod.findUnique({
      where: { id: aPeriodBefore!.id },
    });
    expect(aPeriodAfter!.discountAmount).toBeLessThan(discountBefore);
  });

  it("updateStudent: family change → old family loses promo, new family gains promo", async () => {
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();
    const { updateStudent } = await importStudents();

    const familyOld = await createTestFamily();
    const familyNew = await createTestFamily();

    // A1 in familyOld: committed
    const a1 = await createTestStudent({ familyId: familyOld.id });
    const { group: gA1 } = await createTestGroup({ startTime: "14:30" });
    await addStudentsToGroup(gA1.id, {
      studentIds: [a1.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const mA1 = await prisma.groupMembership.findFirst({
      where: { studentId: a1.id, groupId: gA1.id },
    });
    await resolveTrialMembership(mA1!.id, { action: "commit" });

    // C in familyOld: committed → triggers FAMILY for both A1 and C
    const c = await createTestStudent({ familyId: familyOld.id });
    const { group: gC } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
    });
    await addStudentsToGroup(gC.id, {
      studentIds: [c.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const mC = await prisma.groupMembership.findFirst({
      where: { studentId: c.id, groupId: gC.id },
    });
    await resolveTrialMembership(mC!.id, { action: "commit" });

    // B1 in familyNew: committed
    const b1 = await createTestStudent({ familyId: familyNew.id });
    const { group: gB1 } = await createTestGroup({ startTime: "08:30" });
    await addStudentsToGroup(gB1.id, {
      studentIds: [b1.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const mB1 = await prisma.groupMembership.findFirst({
      where: { studentId: b1.id, groupId: gB1.id },
    });
    await resolveTrialMembership(mB1!.id, { action: "commit" });

    const familyPromo = await prisma.promotion.findFirst({
      where: { type: "FAMILY", isActive: true },
    });

    // A1 and C have FAMILY promo (familyOld has 2 active)
    const spA1Before = await prisma.studentPromotion.findFirst({
      where: { studentId: a1.id, promotionId: familyPromo!.id },
    });
    expect(spA1Before).toBeTruthy();

    // B1 does NOT have FAMILY promo (familyNew has only 1 active)
    const spB1Before = await prisma.studentPromotion.findFirst({
      where: { studentId: b1.id, promotionId: familyPromo!.id },
    });
    expect(spB1Before).toBeNull();

    // Move C from familyOld → familyNew
    const cRecord = await prisma.student.findUnique({ where: { id: c.id } });
    await expectRedirect(() =>
      updateStudent(c.id, studentData({
        firstName: cRecord!.firstName,
        lastName: cRecord!.lastName,
        phone: cRecord!.phone,
        dateOfBirth: cRecord!.dateOfBirth.toISOString().split("T")[0],
        level: cRecord!.level,
        familyId: familyNew.id,
      })),
    );

    // familyOld dropped to 1 → A1's FAMILY promo should be expired
    const spA1After = await prisma.studentPromotion.findUnique({
      where: { id: spA1Before!.id },
    });
    expect(spA1After!.expiresAt).toBeTruthy();

    // familyNew reached 2 → B1 and C should have FAMILY promo
    const spB1After = await prisma.studentPromotion.findFirst({
      where: { studentId: b1.id, promotionId: familyPromo!.id },
    });
    expect(spB1After).toBeTruthy();

    const spCAfter = await prisma.studentPromotion.findFirst({
      where: {
        studentId: c.id,
        promotionId: familyPromo!.id,
        // The new one (not the old expired one from familyOld)
        expiresAt: null,
      },
    });
    expect(spCAfter).toBeTruthy();
  });
});

// ─── REFERRAL ───────────────────────────────────────────────────────────────

describe("REFERRAL: completion + reward promos", () => {
  it("first real payment → referral COMPLETED, reward promos attached to both", async () => {
    const { recordReferral } = await importReferrals();
    const { recordPayment } = await importPayments();
    const { addStudentsToGroup, resolveTrialMembership } =
      await importMemberships();

    // Referrer: committed active student
    const referrer = await createTestStudent();
    const { group: gRef } = await createTestGroup({ startTime: "14:30" });
    await addStudentsToGroup(gRef.id, {
      studentIds: [referrer.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const mRef = await prisma.groupMembership.findFirst({
      where: { studentId: referrer.id, groupId: gRef.id },
    });
    await resolveTrialMembership(mRef!.id, { action: "commit" });

    // Referred: new student
    const referred = await createTestStudent();

    // Record referral
    const refResult = await recordReferral({
      referrerStudentId: referrer.id,
      referredStudentId: referred.id,
    });
    expect(refResult).toEqual({ success: true });

    // Verify PENDING referral
    const referral = await prisma.referral.findUnique({
      where: { referredStudentId: referred.id },
    });
    expect(referral).toBeTruthy();
    expect(referral!.status).toBe("PENDING");

    // Referred: assign to group → commit
    const { group: gReferred } = await createTestGroup({
      startTime: "16:00",
      days: [2, 4, 6],
    });
    await addStudentsToGroup(gReferred.id, {
      studentIds: [referred.id],
      joinDate: "2026-04-01",
      comment: null,
    });
    const mReferred = await prisma.groupMembership.findFirst({
      where: { studentId: referred.id, groupId: gReferred.id },
    });
    await resolveTrialMembership(mReferred!.id, { action: "commit" });

    // Get referred's first billing period and make first payment
    const period = await prisma.studentPaymentPeriod.findFirst({
      where: { groupMembershipId: mReferred!.id },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
    expect(period).toBeTruthy();

    const effectiveDue = period!.amountDue - period!.discountAmount;
    await recordPayment(period!.id, {
      amount: effectiveDue,
      paymentMethod: "cash",
      note: null,
    });

    // Referral should be COMPLETED
    const referralAfter = await prisma.referral.findUnique({
      where: { id: referral!.id },
    });
    expect(referralAfter!.status).toBe("COMPLETED");
    expect(referralAfter!.completedAt).toBeTruthy();

    // Referrer should have "Referral Reward" StudentPromotion
    const referrerReward = await prisma.promotion.findFirst({
      where: { type: "REFERRAL", name: { contains: "Referral Reward" } },
    });
    const spReferrer = await prisma.studentPromotion.findFirst({
      where: { studentId: referrer.id, promotionId: referrerReward!.id },
    });
    expect(spReferrer).toBeTruthy();

    // Referred should have "Referral Welcome" StudentPromotion
    const referredReward = await prisma.promotion.findFirst({
      where: { type: "REFERRAL", name: { contains: "Referral Welcome" } },
    });
    const spReferred = await prisma.studentPromotion.findFirst({
      where: { studentId: referred.id, promotionId: referredReward!.id },
    });
    expect(spReferred).toBeTruthy();
  });

  it("REFERRAL + PROMO_CODE mutual exclusivity → error", async () => {
    const { recordReferral } = await importReferrals();

    // Create a PROMO_CODE promotion
    const promo = await prisma.promotion.create({
      data: {
        name: "Test Code",
        type: "PROMO_CODE",
        code: "EXCLUSIVETEST",
        discountType: "FIXED_AMOUNT",
        discountAmount: 50_000,
        isActive: true,
      },
    });

    // Referred student with PROMO_CODE attached
    const referred = await createTestStudent();
    await prisma.studentPromotion.create({
      data: { studentId: referred.id, promotionId: promo.id },
    });

    // Referrer
    const referrer = await createTestStudent();

    // Try to record referral → should fail
    const result = await recordReferral({
      referrerStudentId: referrer.id,
      referredStudentId: referred.id,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/promo code.*mutually exclusive/i);
  });
});
