/**
 * Close Group — terminal action that retires a group early.
 *
 * Allowed when:
 *  - Group is active
 *  - No active GroupMembership (every membership has leaveDate set)
 *  - No PENDING ScheduledAction referencing the group as source or dest
 *
 * Effects: deletes future SCHEDULED lessons + their TeacherScheduleSlots,
 * deletes future Exams, closes open GroupTeacherHistory row, marks group
 * inactive with closedAt/closedById/closedReason.
 *
 * Preserves: GroupMembership rows (with leaveDate), past lessons + attendance,
 * past exams, billing/payroll history.
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
  createTestGroup,
  createTestStudent,
  createTestMembership,
} from "../helpers/factories";
import { TEST_ADMIN_ID } from "../helpers/constants";

const importCloseGroup = () => import("@/lib/actions/group-close");

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

// Lessons generated in the past should never be deleted by close. We use a
// future startDate in most tests so the entire lesson set is "future".
const FUTURE_START = "2026-06-01";

describe("closeGroup — happy paths", () => {
  it("closes an empty (never-had-students) group", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group } = await createTestGroup({ startDate: FUTURE_START });

    const result = await closeGroup({
      groupId: group.id,
      reason: "ADMIN_ERROR",
    });

    expect(result).toEqual({ success: true });

    const after = await prisma.group.findUniqueOrThrow({
      where: { id: group.id },
    });
    expect(after.isActive).toBe(false);
    expect(after.closedAt).toBeTruthy();
    expect(after.closedById).toBe(TEST_ADMIN_ID);
    expect(after.closedReason).toBe("ADMIN_ERROR");
    expect(after.zoomMeetingId).toBeNull();
  });

  it("deletes future SCHEDULED lessons and their schedule slots", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group, lessonCount } = await createTestGroup({
      startDate: FUTURE_START,
    });

    const lessonsBefore = await prisma.lesson.count({ where: { groupId: group.id } });
    const slotsBefore = await prisma.teacherScheduleSlot.count({ where: { groupId: group.id } });
    expect(lessonsBefore).toBe(lessonCount);
    expect(slotsBefore).toBe(lessonCount);

    await closeGroup({ groupId: group.id, reason: "ADMIN_ERROR" });

    const lessonsAfter = await prisma.lesson.count({ where: { groupId: group.id } });
    const slotsAfter = await prisma.teacherScheduleSlot.count({ where: { groupId: group.id } });
    expect(lessonsAfter).toBe(0);
    expect(slotsAfter).toBe(0);
  });

  it("deletes future exams", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group } = await createTestGroup({ startDate: FUTURE_START });

    // Manually attach an exam (factory doesn't create them)
    await prisma.exam.create({
      data: {
        groupId: group.id,
        type: "MID",
        scheduledDate: new Date("2026-07-15T00:00:00Z"),
      },
    });

    await closeGroup({ groupId: group.id, reason: "ADMIN_ERROR" });

    const exams = await prisma.exam.count({ where: { groupId: group.id } });
    expect(exams).toBe(0);
  });

  it("closes the open GroupTeacherHistory row", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group } = await createTestGroup({ startDate: FUTURE_START });

    const historyBefore = await prisma.groupTeacherHistory.findFirstOrThrow({
      where: { groupId: group.id },
    });
    expect(historyBefore.endDate).toBeNull();

    await closeGroup({ groupId: group.id, reason: "ADMIN_ERROR" });

    const historyAfter = await prisma.groupTeacherHistory.findFirstOrThrow({
      where: { groupId: group.id },
    });
    expect(historyAfter.endDate).not.toBeNull();
  });

  it("preserves historical memberships (left students stay in the record)", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group } = await createTestGroup({ startDate: FUTURE_START });

    const student = await createTestStudent({ status: "INACTIVE" });
    await createTestMembership({ studentId: student.id, groupId: group.id });
    // Mark them as left
    await prisma.groupMembership.updateMany({
      where: { groupId: group.id, studentId: student.id },
      data: { leaveDate: new Date() },
    });

    await closeGroup({ groupId: group.id, reason: "STUDENTS_LEFT" });

    const memberships = await prisma.groupMembership.count({ where: { groupId: group.id } });
    expect(memberships).toBe(1); // still here
  });

  it("preserves past lessons (lessonDate < today)", async () => {
    const { closeGroup } = await importCloseGroup();
    // Group started in the past — some lessons should be < today
    const { group } = await createTestGroup({ startDate: "2026-02-01" });

    const today = new Date();
    const pastBefore = await prisma.lesson.count({
      where: { groupId: group.id, lessonDate: { lt: today } },
    });
    expect(pastBefore).toBeGreaterThan(0);

    await closeGroup({ groupId: group.id, reason: "STUDENTS_LEFT" });

    const pastAfter = await prisma.lesson.count({
      where: { groupId: group.id, lessonDate: { lt: today } },
    });
    expect(pastAfter).toBe(pastBefore);
  });
});

describe("closeGroup — blockers", () => {
  it("returns error when an active membership exists", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group } = await createTestGroup({ startDate: FUTURE_START });

    const student = await createTestStudent({ status: "ACTIVE" });
    await createTestMembership({ studentId: student.id, groupId: group.id });

    const result = await closeGroup({ groupId: group.id, reason: "STUDENTS_LEFT" });

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/active student/i);

    // Group unchanged
    const after = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(after.isActive).toBe(true);
    expect(after.closedAt).toBeNull();
  });

  it("returns error when a pending incoming ScheduledAction exists", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group } = await createTestGroup({ startDate: FUTURE_START });
    const { group: otherGroup } = await createTestGroup({ startDate: FUTURE_START });

    const student = await createTestStudent({ status: "ACTIVE" });

    await prisma.scheduledAction.create({
      data: {
        type: "ASSIGN",
        status: "PENDING",
        effectiveDate: new Date("2026-06-15T00:00:00Z"),
        studentId: student.id,
        destGroupId: group.id,
        payload: {},
        createdById: TEST_ADMIN_ID,
      },
    });

    const result = await closeGroup({ groupId: group.id, reason: "ADMIN_ERROR" });

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/pending scheduled action/i);

    // Unrelated other group still active
    const otherAfter = await prisma.group.findUniqueOrThrow({ where: { id: otherGroup.id } });
    expect(otherAfter.isActive).toBe(true);
  });

  it("returns error when group is already closed", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group } = await createTestGroup({ startDate: FUTURE_START });

    await prisma.group.update({
      where: { id: group.id },
      data: { isActive: false },
    });

    const result = await closeGroup({ groupId: group.id, reason: "ADMIN_ERROR" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/already closed/i);
  });

  it("returns error when group does not exist", async () => {
    const { closeGroup } = await importCloseGroup();
    const result = await closeGroup({
      groupId: "does-not-exist",
      reason: "ADMIN_ERROR",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/not found/i);
  });

  it("validation: rejects invalid reason", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group } = await createTestGroup({ startDate: FUTURE_START });

    const result = await closeGroup({
      groupId: group.id,
      reason: "NOT_A_REASON",
    });
    expect(result).toHaveProperty("error");
  });
});

describe("closeGroup — atomicity", () => {
  it("rolls back all changes if the predicate check fails inside the txn", async () => {
    const { closeGroup } = await importCloseGroup();
    const { group, lessonCount } = await createTestGroup({ startDate: FUTURE_START });

    // Set up a blocker: active membership
    const student = await createTestStudent({ status: "ACTIVE" });
    await createTestMembership({ studentId: student.id, groupId: group.id });

    await closeGroup({ groupId: group.id, reason: "STUDENTS_LEFT" });

    // Nothing should have been deleted
    const lessons = await prisma.lesson.count({ where: { groupId: group.id } });
    const slots = await prisma.teacherScheduleSlot.count({ where: { groupId: group.id } });
    const history = await prisma.groupTeacherHistory.findFirstOrThrow({
      where: { groupId: group.id },
    });
    expect(lessons).toBe(lessonCount);
    expect(slots).toBe(lessonCount);
    expect(history.endDate).toBeNull();
  });
});
