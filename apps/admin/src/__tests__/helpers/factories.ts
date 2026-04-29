/**
 * Factory functions for integration tests.
 *
 * Each factory creates a real DB record with sensible defaults.
 * Pass overrides to customize specific fields.
 *
 * Usage:
 *   const teacher = await createTestTeacher();
 *   const student = await createTestStudent({ level: "INTERMEDIATE" });
 *   const { group, teacher, lessonCount } = await createTestGroup();
 */
import { prisma } from "./db";
import { TEST_ADMIN_ID } from "./constants";
import {
  calculateEndDate,
  generateLessonDates,
} from "@/lib/helpers/lesson-generation";

// ─── Utilities ──────────────────────────────────────────────────────────────

let counter = 0;

/** Unique suffix to avoid collisions between test runs. */
function uid() {
  return `${Date.now()}-${++counter}`;
}

/** Random Uzbek phone number (+998XXXXXXXXX). */
function randomPhone() {
  const digits = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 10),
  ).join("");
  return `+998${digits}`;
}

/** Random 14-digit PINFL (personal identification number). */
function randomPinfl() {
  return Array.from({ length: 14 }, () =>
    Math.floor(Math.random() * 10),
  ).join("");
}

// ─── Teacher ────────────────────────────────────────────────────────────────

interface TeacherOverrides {
  firstName?: string;
  lastName?: string;
  phone?: string;
  pinfl?: string;
  levels?: Array<
    | "BEGINNER"
    | "ELEMENTARY"
    | "PRE_INTERMEDIATE"
    | "INTERMEDIATE"
    | "UPPER_INTERMEDIATE"
    | "IELTS"
  >;
  teachingLanguage?: "UZBEK" | "RUSSIAN" | "ANY";
  /** Group lesson rate in UZS (default: 50_000). */
  groupLessonRate?: number;
  /** Individual lesson rate in UZS (default: 100_000). */
  individualLessonRate?: number;
  /** Rate effective-from date (default: 2025-01-01). */
  rateEffectiveFrom?: Date;
}

/**
 * Create a Teacher with a rate history entry (required for group creation).
 */
export async function createTestTeacher(overrides: TeacherOverrides = {}) {
  const {
    firstName = "Test",
    lastName = `Teacher-${uid()}`,
    phone = randomPhone(),
    pinfl = randomPinfl(),
    levels = ["BEGINNER", "ELEMENTARY", "PRE_INTERMEDIATE"],
    teachingLanguage = "ANY",
    groupLessonRate = 50_000,
    individualLessonRate = 100_000,
    rateEffectiveFrom = new Date("2025-01-01"),
  } = overrides;

  const teacher = await prisma.teacher.create({
    data: { firstName, lastName, phone, pinfl, levels, teachingLanguage },
  });

  await prisma.teacherRateChange.create({
    data: {
      teacherId: teacher.id,
      groupLessonRate,
      individualLessonRate,
      effectiveFrom: rateEffectiveFrom,
      changedById: TEST_ADMIN_ID,
    },
  });

  return teacher;
}

// ─── Student ────────────────────────────────────────────────────────────────

interface StudentOverrides {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  level?:
    | "BEGINNER"
    | "ELEMENTARY"
    | "PRE_INTERMEDIATE"
    | "INTERMEDIATE"
    | "UPPER_INTERMEDIATE"
    | "IELTS";
  status?:
    | "AWAITING_ASSIGNMENT"
    | "AWAITING_REASSIGNMENT"
    | "ACTIVE"
    | "INACTIVE";
  preferredDays?: number[];
  preferredTimeSlots?: string[];
  preferredLanguage?: "UZBEK" | "RUSSIAN" | "ANY";
  preferredLessonType?: "GROUP" | "INDIVIDUAL" | "EITHER";
  familyId?: string | null;
  comment?: string | null;
  leadId?: string | null;
}

/**
 * Create a Student. Default status is AWAITING_ASSIGNMENT.
 */
export async function createTestStudent(overrides: StudentOverrides = {}) {
  const {
    firstName = "Test",
    lastName = `Student-${uid()}`,
    phone = randomPhone(),
    dateOfBirth = new Date("2005-06-15"),
    level = "BEGINNER",
    status = "AWAITING_ASSIGNMENT",
    preferredDays = [1, 3, 5],
    preferredTimeSlots = ["14:30"],
    preferredLanguage = "ANY",
    preferredLessonType = "EITHER",
    familyId = null,
    comment = null,
    leadId = null,
  } = overrides;

  return prisma.student.create({
    data: {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      level,
      status,
      preferredDays,
      preferredTimeSlots,
      preferredLanguage,
      preferredLessonType,
      familyId,
      comment,
      leadId,
    },
  });
}

// ─── Lead ───────────────────────────────────────────────────────────────────

interface LeadOverrides {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date | null;
  language?: string;
  lessonPreference?: "GROUP" | "INDIVIDUAL" | "EITHER" | null;
  selfAssessedLevel?: "COMPLETE_BEGINNER" | "CONTINUING" | null;
  status?: "NEW" | "CONTACTED" | "TRIAL_SCHEDULED" | "CONVERTED" | "LOST";
  note?: string | null;
  adminNote?: string | null;
}

/** Create a Lead. Default status is NEW. */
export async function createTestLead(overrides: LeadOverrides = {}) {
  const {
    firstName = "Test",
    lastName = `Lead-${uid()}`,
    phone = randomPhone(),
    dateOfBirth = new Date("2005-06-15"),
    language = "uz",
    lessonPreference = "GROUP",
    selfAssessedLevel = "COMPLETE_BEGINNER",
    status = "NEW",
    note = null,
    adminNote = null,
  } = overrides;

  return prisma.lead.create({
    data: {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      language,
      lessonPreference,
      selfAssessedLevel,
      status,
      note,
      adminNote,
    },
  });
}

// ─── Family ─────────────────────────────────────────────────────────────────

interface FamilyOverrides {
  name?: string | null;
  parentFirstName?: string;
  parentLastName?: string;
  parentPhone?: string;
}

/**
 * Create a Family record.
 */
export async function createTestFamily(overrides: FamilyOverrides = {}) {
  const {
    name = null,
    parentFirstName = "Parent",
    parentLastName = `Family-${uid()}`,
    parentPhone = randomPhone(),
  } = overrides;

  return prisma.family.create({
    data: { name, parentFirstName, parentLastName, parentPhone },
  });
}

// ─── Group (with Lessons, Schedule Slots, Teacher History) ──────────────────

interface GroupOverrides {
  /** Provide to reuse an existing teacher. Otherwise one is created. */
  teacherId?: string;
  type?: "GROUP" | "INDIVIDUAL";
  days?: number[];
  startTime?: string;
  durationMinutes?: number;
  level?:
    | "BEGINNER"
    | "ELEMENTARY"
    | "PRE_INTERMEDIATE"
    | "INTERMEDIATE"
    | "UPPER_INTERMEDIATE"
    | "IELTS";
  maxStudents?: number;
  /** YYYY-MM-DD. Default: 2026-04-01 (future date, avoids holidays). */
  startDate?: string;
  zoomJoinUrl?: string | null;
  zoomMeetingId?: string | null;
}

/**
 * Create a Group with pre-generated Lessons, TeacherScheduleSlots, and
 * GroupTeacherHistory — mirrors the createGroup server action logic.
 *
 * Returns the group, teacher, and lesson count for assertions.
 */
export async function createTestGroup(overrides: GroupOverrides = {}) {
  const {
    teacherId,
    type = "GROUP",
    days = [1, 3, 5],
    startTime = "14:00",
    durationMinutes = 80,
    level = "BEGINNER",
    maxStudents = type === "GROUP" ? 12 : 1,
    startDate: startDateStr = "2026-04-01",
    zoomJoinUrl = null,
    zoomMeetingId = null,
  } = overrides;

  // Create or reuse teacher
  let teacher;
  if (teacherId) {
    teacher = await prisma.teacher.findUniqueOrThrow({
      where: { id: teacherId },
    });
  } else {
    teacher = await createTestTeacher({ levels: [level] });
  }

  const startDate = new Date(startDateStr + "T00:00:00Z");
  const endDate = calculateEndDate(startDate);

  // Get holidays for lesson date generation
  const holidays = await prisma.holiday.findMany({
    select: { date: true },
  });
  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0]!),
  );

  const lessonDates = generateLessonDates(startDate, endDate, days, holidayDates);

  const group = await prisma.$transaction(async (tx) => {
    const newGroup = await tx.group.create({
      data: {
        type,
        teacherId: teacher.id,
        days,
        startTime,
        durationMinutes,
        level,
        maxStudents,
        startDate,
        endDate,
        zoomJoinUrl,
        zoomMeetingId,
      },
    });

    const lessons = await tx.lesson.createManyAndReturn({
      data: lessonDates.map((date, index) => ({
        groupId: newGroup.id,
        teacherId: teacher.id,
        originalTeacherId: teacher.id,
        lessonNumber: index + 1,
        lessonDate: date,
        startTime,
      })),
    });

    await tx.teacherScheduleSlot.createMany({
      data: lessons.map((lesson) => ({
        teacherId: teacher.id,
        date: lesson.lessonDate,
        startTime,
        groupId: newGroup.id,
        lessonId: lesson.id,
      })),
    });

    await tx.groupTeacherHistory.create({
      data: {
        groupId: newGroup.id,
        teacherId: teacher.id,
        startDate,
      },
    });

    return newGroup;
  });

  return { group, teacher, lessonCount: lessonDates.length };
}

// ─── Group Membership ───────────────────────────────────────────────────────

interface MembershipOverrides {
  studentId: string;
  groupId: string;
  joinDate?: Date;
  isTrial?: boolean;
}

/**
 * Create a GroupMembership (student → group assignment).
 * Does NOT trigger billing period creation — use the addStudentsToGroup
 * server action if you need full billing setup.
 */
export async function createTestMembership(overrides: MembershipOverrides) {
  const {
    studentId,
    groupId,
    joinDate = new Date(),
    isTrial = false,
  } = overrides;

  return prisma.groupMembership.create({
    data: {
      studentId,
      groupId,
      joinDate,
      isTrial,
      assignedById: TEST_ADMIN_ID,
    },
  });
}

// ─── Test Assertions ────────────────────────────────────────────────────────

/**
 * Run an async function that is expected to call redirect().
 * Returns the redirect URL. Throws if no redirect occurs.
 *
 * Usage:
 *   const url = await expectRedirect(() => createStudent(data));
 *   expect(url).toMatch(/^\/students\//);
 */
export async function expectRedirect(
  fn: () => Promise<unknown>,
): Promise<string> {
  try {
    await fn();
    throw new Error("Expected redirect() to be called, but it was not");
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.name === "RedirectError" &&
      "url" in error
    ) {
      return (error as Error & { url: string }).url;
    }
    throw error;
  }
}
