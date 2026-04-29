import { prisma } from "@/server/db";
import { getTrialMembershipAttendance } from "./students";
import { getGroupScheduledCounts } from "@/lib/helpers/capacity";

export async function getReceptionStudents() {
  return prisma.student.findMany({
    where: { status: "AWAITING_ASSIGNMENT" },
    select: {
      id: true,
      crmCode: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      level: true,
      progressStage: true,
      createdAt: true,
      preferredDays: true,
      preferredTimeSlots: true,
      preferredLanguage: true,
      preferredLessonType: true,
      comment: true,
      family: { select: { parentPhone: true } },
    },
    orderBy: { createdAt: "asc" }, // oldest first — longest-waiting students at top
  });
}

export async function getReceptionCount() {
  return prisma.student.count({
    where: { status: "AWAITING_ASSIGNMENT" },
  });
}

// ── First Lessons: active trial students with lesson + attendance info ──

export type FirstLessonRow = {
  membershipId: string;
  studentId: string;
  studentName: string;
  crmCode: string;
  phone: string | null;
  groupId: string;
  groupPublicId: string;
  groupType: string;
  groupDays: number[];
  groupStartTime: string;
  zoomJoinUrl: string | null;
  lessonDate: Date | null;
  lessonStatus: string | null;
  attendanceStatus: "upcoming" | "attended" | "absent" | "no_record";
};

export async function getFirstLessonsData(): Promise<FirstLessonRow[]> {
  // 1. Fetch active trial memberships
  const memberships = await prisma.groupMembership.findMany({
    where: { isTrial: true, leaveDate: null },
    include: {
      student: {
        select: { id: true, crmCode: true, firstName: true, lastName: true, phone: true },
      },
      group: {
        select: { id: true, publicId: true, type: true, startTime: true, days: true, zoomJoinUrl: true },
      },
    },
    orderBy: { joinDate: "asc" },
  });

  if (memberships.length === 0) return [];

  // 2. Find each membership's trial lesson — first non-cancelled lesson >= joinDate
  const groupIds = [...new Set(memberships.map((m) => m.groupId))];
  const minJoinDate = memberships.reduce(
    (min, m) => (m.joinDate < min ? m.joinDate : min),
    memberships[0]!.joinDate,
  );

  const lessons = await prisma.lesson.findMany({
    where: {
      groupId: { in: groupIds },
      lessonDate: { gte: minJoinDate },
      status: { not: "CANCELLED" },
    },
    select: { id: true, groupId: true, lessonDate: true, status: true },
    orderBy: [{ groupId: "asc" }, { lessonDate: "asc" }],
  });

  // Group lessons by groupId for fast lookup
  const lessonsByGroup = new Map<string, typeof lessons>();
  for (const l of lessons) {
    let arr = lessonsByGroup.get(l.groupId);
    if (!arr) {
      arr = [];
      lessonsByGroup.set(l.groupId, arr);
    }
    arr.push(l);
  }

  // 3. Check attendance (boolean: has any attendance)
  const attendanceSet = await getTrialMembershipAttendance(
    memberships.map((m) => ({
      id: m.id,
      studentId: m.studentId,
      groupId: m.groupId,
      joinDate: m.joinDate,
      leaveDate: m.leaveDate,
    })),
  );

  // 4. For memberships WITH attendance, check isAbsent on their specific lesson
  const membershipLessonMap = new Map<string, { lessonId: string; lessonDate: Date; lessonStatus: string }>();
  for (const m of memberships) {
    const groupLessons = lessonsByGroup.get(m.groupId) ?? [];
    const firstLesson = groupLessons.find((l) => l.lessonDate >= m.joinDate);
    if (firstLesson) {
      membershipLessonMap.set(m.id, {
        lessonId: firstLesson.id,
        lessonDate: firstLesson.lessonDate,
        lessonStatus: firstLesson.status,
      });
    }
  }

  // Batch-fetch absence status for memberships that have attendance AND a matched lesson
  const withAttendanceAndLesson = memberships.filter(
    (m) => attendanceSet.has(m.id) && membershipLessonMap.has(m.id),
  );
  const absenceMap = new Map<string, boolean>(); // membershipId → isAbsent

  if (withAttendanceAndLesson.length > 0) {
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        OR: withAttendanceAndLesson.map((m) => ({
          studentId: m.studentId,
          groupId: m.groupId,
          lessonId: membershipLessonMap.get(m.id)!.lessonId,
        })),
      },
      select: { studentId: true, groupId: true, lessonId: true, isAbsent: true },
    });

    // Map back to memberships
    for (const m of withAttendanceAndLesson) {
      const lesson = membershipLessonMap.get(m.id)!;
      const record = attendanceRecords.find(
        (r) => r.studentId === m.studentId && r.groupId === m.groupId && r.lessonId === lesson.lessonId,
      );
      if (record) absenceMap.set(m.id, record.isAbsent);
    }
  }

  // 5. Build result
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return memberships.map((m) => {
    const lesson = membershipLessonMap.get(m.id);

    let attendanceStatus: FirstLessonRow["attendanceStatus"];
    if (!lesson || lesson.lessonDate > today) {
      attendanceStatus = "upcoming";
    } else if (attendanceSet.has(m.id)) {
      attendanceStatus = absenceMap.get(m.id) ? "absent" : "attended";
    } else {
      attendanceStatus = "no_record";
    }

    return {
      membershipId: m.id,
      studentId: m.student.id,
      studentName: `${m.student.firstName} ${m.student.lastName}`,
      crmCode: m.student.crmCode,
      phone: m.student.phone,
      groupId: m.group.id,
      groupPublicId: m.group.publicId,
      groupType: m.group.type,
      groupDays: m.group.days,
      groupStartTime: m.group.startTime,
      zoomJoinUrl: m.group.zoomJoinUrl,
      lessonDate: lesson?.lessonDate ?? null,
      lessonStatus: lesson?.lessonStatus ?? null,
      attendanceStatus,
    };
  });
}

// ── Second Lessons: committed-from-trial students with unpaid current-month billing ──

export type SecondLessonRow = {
  membershipId: string;
  studentId: string;
  studentName: string;
  crmCode: string;
  phone: string | null;
  groupId: string;
  groupPublicId: string;
  lessonsAttended: number;
  amountDue: number;
  discountAmount: number;
  amountPaid: number;
  paymentStatus: string;
  remaining: number;
};

export async function getSecondLessonsData(): Promise<SecondLessonRow[]> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  // 1. Fetch committed-from-trial memberships with unpaid current-month billing
  const memberships = await prisma.groupMembership.findMany({
    where: {
      wasTrialOriginally: true,
      isTrial: false,
      leaveDate: null,
      paymentPeriods: {
        some: {
          periodYear: year,
          periodMonth: month,
          paymentStatus: { not: "PAID" },
        },
      },
    },
    include: {
      student: {
        select: { id: true, crmCode: true, firstName: true, lastName: true, phone: true },
      },
      group: {
        select: { id: true, publicId: true },
      },
      paymentPeriods: {
        where: { periodYear: year, periodMonth: month },
        select: {
          amountDue: true,
          discountAmount: true,
          amountPaid: true,
          paymentStatus: true,
        },
      },
    },
    orderBy: { joinDate: "asc" },
  });

  if (memberships.length === 0) return [];

  // 2. Count lessons attended per membership (non-absent attendance for COMPLETED lessons since joinDate)
  const attendedCounts = await Promise.all(
    memberships.map((m) =>
      prisma.attendance.count({
        where: {
          studentId: m.studentId,
          groupId: m.groupId,
          isAbsent: false,
          lesson: {
            status: "COMPLETED",
            lessonDate: { gte: m.joinDate },
          },
        },
      }),
    ),
  );

  // 3. Build result
  const rows: SecondLessonRow[] = [];

  for (let i = 0; i < memberships.length; i++) {
    const m = memberships[i]!;
    const period = m.paymentPeriods[0];
    if (!period) continue;

    const remaining = period.amountDue - period.discountAmount - period.amountPaid;

    rows.push({
      membershipId: m.id,
      studentId: m.student.id,
      studentName: `${m.student.firstName} ${m.student.lastName}`,
      crmCode: m.student.crmCode,
      phone: m.student.phone,
      groupId: m.group.id,
      groupPublicId: m.group.publicId,
      lessonsAttended: attendedCounts[i]!,
      amountDue: period.amountDue,
      discountAmount: period.discountAmount,
      amountPaid: period.amountPaid,
      paymentStatus: period.paymentStatus,
      remaining,
    });
  }

  return rows.sort((a, b) => b.lessonsAttended - a.lessonsAttended); // most urgent first
}

/** Active groups with available seats, for the assign-to-group dialog */
export async function getGroupsForAssignment() {
  const [groups, scheduledCounts] = await Promise.all([
    prisma.group.findMany({
      where: { isActive: true },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true,
            teachingLanguage: true,
          },
        },
        memberships: {
          where: { leaveDate: null },
          select: { id: true },
        },
      },
      orderBy: [{ level: "asc" }, { startTime: "asc" }],
    }),
    getGroupScheduledCounts(),
  ]);

  return groups
    .map((g) => {
      const counts = scheduledCounts.get(g.id);
      const departures = counts?.departures ?? 0;
      const arrivals = counts?.arrivals ?? 0;
      const effectiveCount = g.memberships.length - departures + arrivals;
      return {
        id: g.id,
        publicId: g.publicId,
        type: g.type,
        level: g.level,
        progressStage: g.progressStage,
        days: g.days,
        startTime: g.startTime,
        teacherName: `${g.teacher.firstName} ${g.teacher.lastName}`,
        teachingLanguage: g.teacher.teachingLanguage,
        activeCount: g.memberships.length,
        availableSeats: g.maxStudents - effectiveCount,
        maxStudents: g.maxStudents,
        scheduledDepartures: departures,
        scheduledArrivals: arrivals,
      };
    })
    .filter((g) => g.availableSeats > 0);
}
