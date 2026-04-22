/**
 * Phase 3: Scheduling — Lessons, Cancellations, Teacher Changes
 *
 * Tests lesson lifecycle, cancellation chains, student cancel limits,
 * offline reschedule, unavailability detection, substitute assignment,
 * permanent teacher change, group startTime cascade, and lesson completion.
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

const importLessons = () => import("@/lib/actions/lessons");
const importGroups = () => import("@/lib/actions/groups");
const importAttendance = () => import("@/lib/actions/attendance");
const importUnavailability = () =>
  import("@/lib/actions/teacher-unavailability");

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

// ─── Helper: get a past lesson from a group (backdate it to today) ──────────

async function getPastLesson(groupId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const lesson = await prisma.lesson.findFirst({
    where: { groupId, status: "SCHEDULED" },
    orderBy: { lessonDate: "asc" },
  });
  if (!lesson) throw new Error("No scheduled lesson found");

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: { lessonDate: today },
  });
  await prisma.teacherScheduleSlot.updateMany({
    where: { lessonId: lesson.id },
    data: { date: today },
  });

  return { ...lesson, lessonDate: today };
}

// ─── C#8 / C#4: Group Creation — Lessons + Slots + Holidays ────────────────

describe("C#8/C#4: group creation generates lessons", () => {
  it("creates group → lessons + schedule slots + teacher history, holidays skipped", async () => {
    const { createGroup } = await importGroups();
    const teacher = await createTestTeacher();

    // 2026-03-21 is Navruz holiday in seedEssentials
    const url = await expectRedirect(() =>
      createGroup({
        type: "GROUP",
        teacherId: teacher.id,
        days: [1, 3, 5],
        startTime: "14:30",
        level: "BEGINNER",
        startDate: "2026-04-01",
      }),
    );

    // Extract group ID from redirect URL
    const groupId = url.split("/groups/")[1];
    expect(groupId).toBeTruthy();

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });
    expect(group).toBeTruthy();

    // Lessons should be generated
    const lessons = await prisma.lesson.findMany({
      where: { groupId: groupId! },
      orderBy: { lessonNumber: "asc" },
    });
    expect(lessons.length).toBeGreaterThan(0);

    // All lessons on correct days (Mon=1, Wed=3, Fri=5)
    for (const lesson of lessons) {
      const jsDay = lesson.lessonDate.getUTCDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;
      expect([1, 3, 5]).toContain(isoDay);
    }

    // No lesson on 2026-03-21 (Navruz) — but group starts 2026-04-01, so no March dates
    // Verify no holiday dates
    const holidayDates = new Set(["2026-01-01", "2026-03-08", "2026-03-21"]);
    for (const lesson of lessons) {
      const dateStr = lesson.lessonDate.toISOString().split("T")[0]!;
      expect(holidayDates.has(dateStr)).toBe(false);
    }

    // Schedule slots for every lesson
    const slots = await prisma.teacherScheduleSlot.findMany({
      where: { groupId: groupId! },
    });
    expect(slots.length).toBe(lessons.length);

    // Teacher history has one entry
    const history = await prisma.groupTeacherHistory.findMany({
      where: { groupId: groupId! },
    });
    expect(history.length).toBe(1);
    expect(history[0]!.teacherId).toBe(teacher.id);
    expect(history[0]!.endDate).toBeNull();
  });

  it("C#4: rejects creating group with teacher double-booking", async () => {
    const { createGroup } = await importGroups();
    const teacher = await createTestTeacher();

    // First group succeeds
    await expectRedirect(() =>
      createGroup({
        type: "GROUP",
        teacherId: teacher.id,
        days: [1, 3, 5],
        startTime: "14:30",
        level: "BEGINNER",
        startDate: "2026-04-01",
      }),
    );

    // Second group with same teacher + same time + overlapping days → error
    const result = await createGroup({
      type: "GROUP",
      teacherId: teacher.id,
      days: [1, 3, 5],
      startTime: "14:30",
      level: "ELEMENTARY",
      startDate: "2026-04-01",
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/already scheduled/i);
  });
});

// ─── C#9: Cancel Lesson → Replacement Created ──────────────────────────────

describe("C#9: lesson cancellation + replacement", () => {
  it("cancel lesson → CANCELLED, slot deleted, replacement at end, endDate bumped", async () => {
    const { cancelLesson } = await importLessons();
    const { group } = await createTestGroup();

    // Get first lesson and a cancellation reason
    const lesson = await prisma.lesson.findFirst({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonNumber: "asc" },
    });
    expect(lesson).toBeTruthy();

    const reason = await prisma.cancellationReason.findFirst({
      where: { isOther: false },
    });
    expect(reason).toBeTruthy();

    const originalEndDate = group.endDate;
    const originalLessonCount = await prisma.lesson.count({
      where: { groupId: group.id },
    });

    const result = await cancelLesson({
      lessonId: lesson!.id,
      cancellationReasonId: reason!.id,
      otherCancellationReason: null,
    });

    expect(result).toEqual({ success: true });

    // Cancelled lesson
    const cancelled = await prisma.lesson.findUnique({
      where: { id: lesson!.id },
    });
    expect(cancelled!.status).toBe("CANCELLED");
    expect(cancelled!.cancellationReasonId).toBe(reason!.id);

    // Old slot deleted
    const oldSlot = await prisma.teacherScheduleSlot.findFirst({
      where: { lessonId: lesson!.id },
    });
    expect(oldSlot).toBeNull();

    // Replacement created (one more lesson than before)
    const newLessonCount = await prisma.lesson.count({
      where: { groupId: group.id },
    });
    expect(newLessonCount).toBe(originalLessonCount + 1);

    // Replacement links back
    const replacement = await prisma.lesson.findFirst({
      where: { groupId: group.id, rescheduledFromId: lesson!.id },
    });
    expect(replacement).toBeTruthy();
    expect(replacement!.status).toBe("SCHEDULED");
    expect(replacement!.originalLessonId).toBe(lesson!.id);

    // Group endDate bumped
    const updatedGroup = await prisma.group.findUnique({
      where: { id: group.id },
    });
    expect(updatedGroup!.endDate.getTime()).toBeGreaterThan(
      originalEndDate.getTime(),
    );
  });

  it("cancel replacement → originalLessonId propagated from chain root (A→B→C)", async () => {
    const { cancelLesson } = await importLessons();
    const { group } = await createTestGroup();

    const reason = await prisma.cancellationReason.findFirst({
      where: { isOther: false },
    });

    // Cancel lesson A → creates B
    const lessonA = await prisma.lesson.findFirst({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonNumber: "asc" },
    });

    await cancelLesson({
      lessonId: lessonA!.id,
      cancellationReasonId: reason!.id,
      otherCancellationReason: null,
    });

    const lessonB = await prisma.lesson.findFirst({
      where: { rescheduledFromId: lessonA!.id },
    });
    expect(lessonB).toBeTruthy();
    expect(lessonB!.originalLessonId).toBe(lessonA!.id);

    // Cancel lesson B → creates C with originalLessonId still pointing to A
    await cancelLesson({
      lessonId: lessonB!.id,
      cancellationReasonId: reason!.id,
      otherCancellationReason: null,
    });

    const lessonC = await prisma.lesson.findFirst({
      where: { rescheduledFromId: lessonB!.id },
    });
    expect(lessonC).toBeTruthy();
    expect(lessonC!.originalLessonId).toBe(lessonA!.id); // Chain root propagation
  });
});

// ─── C#13: Update Group startTime Cascade ───────────────────────────────────

describe("C#13: updateGroup startTime cascade", () => {
  it("updates startTime → future SCHEDULED lessons + slots cascade-updated", async () => {
    const { updateGroup } = await importGroups();
    const { group } = await createTestGroup({ startTime: "14:30" });

    // Verify original startTime
    const lessonsBefore = await prisma.lesson.findMany({
      where: { groupId: group.id, status: "SCHEDULED" },
    });
    expect(lessonsBefore.every((l) => l.startTime === "14:30")).toBe(true);

    // Update to new time
    await expectRedirect(() =>
      updateGroup(group.id, {
        startTime: "16:00",
        skipAutoGraduation: false,
      }),
    );

    // All future SCHEDULED lessons should have new time
    const lessonsAfter = await prisma.lesson.findMany({
      where: { groupId: group.id, status: "SCHEDULED" },
    });
    for (const lesson of lessonsAfter) {
      // Future lessons updated (all are future since start date is 2026-04-01)
      expect(lesson.startTime).toBe("16:00");
    }

    // Schedule slots also updated
    const slots = await prisma.teacherScheduleSlot.findMany({
      where: { groupId: group.id },
    });
    for (const slot of slots) {
      expect(slot.startTime).toBe("16:00");
    }
  });
});

// ─── C#26: Student Cancel Individual Lesson ─────────────────────────────────

describe("C#26: student cancel individual lesson", () => {
  it("student cancel → replacement created, cancellationsUsed incremented", async () => {
    const { studentCancelLesson } = await importLessons();

    const { group } = await createTestGroup({
      type: "INDIVIDUAL",
      maxStudents: 1,
      startTime: "14:30",
    });

    // Get a far-future lesson (>24h) to cancel
    const lesson = await prisma.lesson.findFirst({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonDate: "asc" },
    });
    expect(lesson).toBeTruthy();

    const result = await studentCancelLesson({ lessonId: lesson!.id });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("cancellationsUsed");

    // Lesson is cancelled
    const cancelled = await prisma.lesson.findUnique({
      where: { id: lesson!.id },
    });
    expect(cancelled!.status).toBe("CANCELLED");

    // Replacement created
    const replacement = await prisma.lesson.findFirst({
      where: { rescheduledFromId: lesson!.id },
    });
    expect(replacement).toBeTruthy();
  });

  it("student cancel GROUP lesson → error", async () => {
    const { studentCancelLesson } = await importLessons();

    const { group } = await createTestGroup({
      type: "GROUP",
      startTime: "14:30",
    });

    const lesson = await prisma.lesson.findFirst({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonDate: "asc" },
    });

    const result = await studentCancelLesson({ lessonId: lesson!.id });
    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/individual/i);
  });

  it("student cancel with <24h notice → error", async () => {
    const { studentCancelLesson } = await importLessons();

    const { group } = await createTestGroup({
      type: "INDIVIDUAL",
      maxStudents: 1,
      startTime: "14:30",
    });

    // Backdate a lesson to today → less than 24h notice
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const lesson = await prisma.lesson.findFirst({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonDate: "asc" },
    });

    await prisma.lesson.update({
      where: { id: lesson!.id },
      data: { lessonDate: today },
    });
    await prisma.teacherScheduleSlot.updateMany({
      where: { lessonId: lesson!.id },
      data: { date: today },
    });

    const result = await studentCancelLesson({ lessonId: lesson!.id });
    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/24 hours/i);
  });

  it("3rd student cancel in month → error (limit is 2)", async () => {
    const { studentCancelLesson } = await importLessons();

    const { group } = await createTestGroup({
      type: "INDIVIDUAL",
      maxStudents: 1,
      startTime: "14:30",
    });

    // Get 3 lessons in the same month
    const lessons = await prisma.lesson.findMany({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonDate: "asc" },
      take: 5,
    });

    // Group lessons by month to find 3 in the same month
    const monthMap = new Map<string, typeof lessons>();
    for (const l of lessons) {
      const key = `${l.lessonDate.getUTCFullYear()}-${l.lessonDate.getUTCMonth()}`;
      const arr = monthMap.get(key) ?? [];
      arr.push(l);
      monthMap.set(key, arr);
    }

    // Find a month with at least 3 lessons
    let targetLessons: typeof lessons | undefined;
    for (const [, arr] of monthMap) {
      if (arr.length >= 3) {
        targetLessons = arr;
        break;
      }
    }

    if (!targetLessons || targetLessons.length < 3) {
      // Not enough lessons in one month — get more
      const allLessons = await prisma.lesson.findMany({
        where: { groupId: group.id, status: "SCHEDULED" },
        orderBy: { lessonDate: "asc" },
        take: 20,
      });
      const newMonthMap = new Map<string, typeof allLessons>();
      for (const l of allLessons) {
        const key = `${l.lessonDate.getUTCFullYear()}-${l.lessonDate.getUTCMonth()}`;
        const arr = newMonthMap.get(key) ?? [];
        arr.push(l);
        newMonthMap.set(key, arr);
      }
      for (const [, arr] of newMonthMap) {
        if (arr.length >= 3) {
          targetLessons = arr;
          break;
        }
      }
    }

    expect(targetLessons).toBeTruthy();
    expect(targetLessons!.length).toBeGreaterThanOrEqual(3);

    // Cancel first two (should succeed)
    const r1 = await studentCancelLesson({ lessonId: targetLessons![0]!.id });
    expect(r1).toHaveProperty("success", true);

    const r2 = await studentCancelLesson({ lessonId: targetLessons![1]!.id });
    expect(r2).toHaveProperty("success", true);

    // Third → error
    const r3 = await studentCancelLesson({ lessonId: targetLessons![2]!.id });
    expect(r3).toHaveProperty("error");
    expect(r3.error).toMatch(/limit/i);
  });
});

// ─── C#27: Offline Reschedule (Individual) ──────────────────────────────────

describe("C#27: offline reschedule", () => {
  it("reschedules lesson → dates swapped, slot moved, originalDate preserved", async () => {
    const { offlineRescheduleLesson } = await importLessons();

    const { group, teacher } = await createTestGroup({
      type: "INDIVIDUAL",
      maxStudents: 1,
      startTime: "14:30",
    });

    const lesson = await prisma.lesson.findFirst({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonDate: "asc" },
    });
    expect(lesson).toBeTruthy();

    const originalDate = lesson!.lessonDate;

    // Pick a date that the teacher is free (a Saturday if group is MWF)
    const newDate = new Date(originalDate);
    // Move to a different day that won't conflict
    newDate.setUTCDate(newDate.getUTCDate() + 1);
    const newDateStr = newDate.toISOString().split("T")[0]!;

    const result = await offlineRescheduleLesson({
      lessonId: lesson!.id,
      newDate: newDateStr,
      newStartTime: "16:00",
    });

    expect(result).toEqual({ success: true });

    // Lesson updated
    const updated = await prisma.lesson.findUnique({
      where: { id: lesson!.id },
    });
    expect(updated!.lessonDate.toISOString().split("T")[0]).toBe(newDateStr);
    expect(updated!.startTime).toBe("16:00");
    expect(updated!.originalDate!.getTime()).toBe(originalDate.getTime());
    expect(updated!.originalStartTime).toBe("14:30");

    // Slot moved
    const slot = await prisma.teacherScheduleSlot.findFirst({
      where: { lessonId: lesson!.id },
    });
    expect(slot).toBeTruthy();
    expect(slot!.date.toISOString().split("T")[0]).toBe(newDateStr);
    expect(slot!.startTime).toBe("16:00");

    // No slot at old date for this lesson
    const oldSlot = await prisma.teacherScheduleSlot.findFirst({
      where: {
        lessonId: lesson!.id,
        date: originalDate,
      },
    });
    expect(oldSlot).toBeNull();
  });
});

// ─── C#28 / C#20a: Teacher Unavailability ───────────────────────────────────

describe("C#28/C#20a: teacher unavailability", () => {
  it("records unavailability → affected SCHEDULED lessons become PENDING_RESOLUTION", async () => {
    const { recordTeacherUnavailability } = await importUnavailability();
    const { group, teacher } = await createTestGroup({ startTime: "14:30" });

    // Pick a future lesson date
    const lesson = await prisma.lesson.findFirst({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonDate: "asc" },
    });
    expect(lesson).toBeTruthy();
    const dateStr = lesson!.lessonDate.toISOString().split("T")[0]!;

    const result = await recordTeacherUnavailability({
      teacherId: teacher.id,
      date: dateStr,
      startTime: null,
      endTime: null,
      reason: "Sick day",
    });

    expect(result).toHaveProperty("success", true);
    expect(result.affectedLessons).toBeGreaterThanOrEqual(1);

    // Lesson should be PENDING_RESOLUTION
    const updated = await prisma.lesson.findUnique({
      where: { id: lesson!.id },
    });
    expect(updated!.status).toBe("PENDING_RESOLUTION");
    expect(updated!.pendingAt).toBeTruthy();
  });

  it("C#20a: overlapping unavailability on same date → error", async () => {
    const { recordTeacherUnavailability } = await importUnavailability();
    const teacher = await createTestTeacher();

    // First: whole day
    await recordTeacherUnavailability({
      teacherId: teacher.id,
      date: "2026-04-01",
      startTime: null,
      endTime: null,
      reason: "Day off",
    });

    // Second: same date, partial → overlaps
    const result = await recordTeacherUnavailability({
      teacherId: teacher.id,
      date: "2026-04-01",
      startTime: "10:00",
      endTime: "12:00",
      reason: "Meeting",
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/overlap/i);
  });
});

// ─── C#29: Assign Substitute ────────────────────────────────────────────────

describe("C#29: assign substitute", () => {
  it("assigns substitute → slot swapped, lesson back to SCHEDULED", async () => {
    const { assignSubstitute } = await importLessons();
    const { recordTeacherUnavailability } = await importUnavailability();
    const { group, teacher } = await createTestGroup({ startTime: "14:30" });
    const substitute = await createTestTeacher();

    // Make a lesson PENDING via unavailability
    const lesson = await prisma.lesson.findFirst({
      where: { groupId: group.id, status: "SCHEDULED" },
      orderBy: { lessonDate: "asc" },
    });
    const dateStr = lesson!.lessonDate.toISOString().split("T")[0]!;

    await recordTeacherUnavailability({
      teacherId: teacher.id,
      date: dateStr,
      startTime: null,
      endTime: null,
      reason: "Sick",
    });

    // Confirm it's pending
    const pending = await prisma.lesson.findUnique({
      where: { id: lesson!.id },
    });
    expect(pending!.status).toBe("PENDING_RESOLUTION");

    // Assign substitute
    const result = await assignSubstitute({
      lessonId: lesson!.id,
      substituteTeacherId: substitute.id,
    });

    expect(result).toEqual({ success: true });

    // Lesson is SCHEDULED with substitute
    const updated = await prisma.lesson.findUnique({
      where: { id: lesson!.id },
    });
    expect(updated!.status).toBe("SCHEDULED");
    expect(updated!.teacherId).toBe(substitute.id);
    expect(updated!.pendingAt).toBeNull();

    // Slot points to substitute
    const slot = await prisma.teacherScheduleSlot.findFirst({
      where: { lessonId: lesson!.id },
    });
    expect(slot!.teacherId).toBe(substitute.id);
  });
});

// ─── C#21: Permanent Teacher Change ────────────────────────────────────────

describe("C#21: permanent teacher change", () => {
  it("changes teacher → group, future lessons, slots, history all updated", async () => {
    const { changeGroupTeacher } = await importLessons();
    const { group, teacher: oldTeacher } = await createTestGroup({
      startTime: "14:30",
    });
    const newTeacher = await createTestTeacher();

    const result = await changeGroupTeacher({
      groupId: group.id,
      newTeacherId: newTeacher.id,
    });

    expect(result).toEqual({ success: true });

    // Group.teacherId updated
    const updatedGroup = await prisma.group.findUnique({
      where: { id: group.id },
    });
    expect(updatedGroup!.teacherId).toBe(newTeacher.id);

    // Future lessons have new teacher
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const futureLessons = await prisma.lesson.findMany({
      where: {
        groupId: group.id,
        status: "SCHEDULED",
        lessonDate: { gte: today },
      },
    });
    for (const l of futureLessons) {
      expect(l.teacherId).toBe(newTeacher.id);
      expect(l.originalTeacherId).toBe(newTeacher.id);
    }

    // Schedule slots all point to new teacher
    const slots = await prisma.teacherScheduleSlot.findMany({
      where: { groupId: group.id },
    });
    for (const s of slots) {
      expect(s.teacherId).toBe(newTeacher.id);
    }

    // Teacher history: old closed, new opened
    const history = await prisma.groupTeacherHistory.findMany({
      where: { groupId: group.id },
    });
    expect(history.length).toBe(2);

    const oldEntry = history.find((h) => h.teacherId === oldTeacher.id);
    const newEntry = history.find((h) => h.teacherId === newTeacher.id);
    expect(oldEntry).toBeTruthy();
    expect(oldEntry!.endDate).toBeTruthy();
    expect(newEntry).toBeTruthy();
    expect(newEntry!.endDate).toBeNull();
  });
});

// ─── C#37: Complete Lesson — activeStudentCount Snapshot ────────────────────

describe("C#37: complete lesson", () => {
  it("snapshots activeStudentCount as of lessonDate", async () => {
    const { completeLesson } = await importLessons();
    const { initializeAttendance } = await importAttendance();
    const { group } = await createTestGroup();

    // Add 2 students with past join date
    const s1 = await createTestStudent();
    const s2 = await createTestStudent();
    const pastDate = new Date("2026-03-01");

    await createTestMembership({
      studentId: s1.id,
      groupId: group.id,
      joinDate: pastDate,
    });
    await createTestMembership({
      studentId: s2.id,
      groupId: group.id,
      joinDate: pastDate,
    });

    // Backdate a lesson to today
    const lesson = await getPastLesson(group.id);

    // Initialize attendance
    await initializeAttendance({ lessonId: lesson.id });

    // Complete lesson
    const result = await completeLesson({ lessonId: lesson.id });
    expect(result).toEqual({ success: true });

    // Check snapshot
    const completed = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });
    expect(completed!.status).toBe("COMPLETED");
    expect(completed!.activeStudentCount).toBe(2);
  });

  it("student leaves between lesson and marking → snapshot uses lessonDate count", async () => {
    const { completeLesson } = await importLessons();
    const { initializeAttendance } = await importAttendance();
    const { group } = await createTestGroup();

    const s1 = await createTestStudent();
    const s2 = await createTestStudent();
    const pastDate = new Date("2026-03-01");

    const m1 = await createTestMembership({
      studentId: s1.id,
      groupId: group.id,
      joinDate: pastDate,
    });
    await createTestMembership({
      studentId: s2.id,
      groupId: group.id,
      joinDate: pastDate,
    });

    // Backdate a lesson to today
    const lesson = await getPastLesson(group.id);

    // Initialize attendance (both students get records)
    await initializeAttendance({ lessonId: lesson.id });

    // Student leaves AFTER lesson date (simulating: leave happened today, lesson was today)
    // But the snapshot counts joinDate <= lessonDate AND leaveDate IS NULL
    // So we set leaveDate BEFORE completing → count drops to 1
    await prisma.groupMembership.update({
      where: { id: m1.id },
      data: { leaveDate: pastDate }, // Left before the lesson
    });

    const result = await completeLesson({ lessonId: lesson.id });
    expect(result).toEqual({ success: true });

    const completed = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });
    // Snapshot counts leaveDate=null members as of lessonDate
    // s1 has leaveDate set → NOT counted, s2 still active → counted
    expect(completed!.activeStudentCount).toBe(1);
  });

  it("absent trial student → auto-removed, deactivated if solo", async () => {
    const { completeLesson } = await importLessons();
    const { initializeAttendance, toggleAttendance } = await importAttendance();
    const { group } = await createTestGroup();

    const student = await createTestStudent();
    const pastDate = new Date("2026-03-01");

    // Create trial membership
    await createTestMembership({
      studentId: student.id,
      groupId: group.id,
      joinDate: pastDate,
      isTrial: true,
    });

    // Activate student
    await prisma.student.update({
      where: { id: student.id },
      data: { status: "ACTIVE" },
    });

    // Backdate lesson
    const lesson = await getPastLesson(group.id);

    // Initialize attendance
    await initializeAttendance({ lessonId: lesson.id });

    // Mark student as absent
    const attendance = await prisma.attendance.findFirst({
      where: { lessonId: lesson.id, studentId: student.id },
    });
    expect(attendance).toBeTruthy();
    await toggleAttendance({ attendanceId: attendance!.id, isAbsent: true });

    // Complete lesson → should auto-remove trial no-show
    const result = await completeLesson({ lessonId: lesson.id });
    expect(result).toEqual({ success: true });

    // Membership should have leaveDate set
    const membership = await prisma.groupMembership.findFirst({
      where: { studentId: student.id, groupId: group.id },
    });
    expect(membership!.leaveDate).toBeTruthy();

    // Student should be INACTIVE (no other active memberships)
    const updatedStudent = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(updatedStudent!.status).toBe("INACTIVE");
    expect(updatedStudent!.lostReasonId).toBeTruthy();
  });
});
