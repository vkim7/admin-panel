import { prisma } from "@/server/db";

export type TrialHistoryEntry = Awaited<ReturnType<typeof getTeacherTrialHistory>>[number];

export async function getTeacherTrialHistory(teacherId: string) {
  const memberships = await prisma.groupMembership.findMany({
    where: { trialTeacherId: teacherId },
    include: {
      student: {
        select: { id: true, crmCode: true, firstName: true, lastName: true },
      },
      group: {
        select: { id: true, publicId: true, type: true },
      },
    },
    orderBy: { joinDate: "desc" },
  });

  if (memberships.length === 0) return [];

  // Bulk-fetch attendance for all trial memberships
  const membershipGroupPairs = memberships.map((m) => ({
    studentId: m.studentId,
    groupId: m.groupId,
  }));

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      OR: membershipGroupPairs.map((p) => ({
        studentId: p.studentId,
        groupId: p.groupId,
      })),
    },
    select: {
      studentId: true,
      groupId: true,
      lesson: { select: { teacherId: true } },
    },
  });

  // Build lookup: "studentId:groupId" → { hasAttendance, actualTeacherId }
  const attendanceLookup = new Map<
    string,
    { hasAttendance: boolean; actualTeacherId: string | null }
  >();
  for (const a of attendanceRecords) {
    const key = `${a.studentId}:${a.groupId}`;
    if (!attendanceLookup.has(key)) {
      attendanceLookup.set(key, {
        hasAttendance: true,
        actualTeacherId: a.lesson.teacherId,
      });
    }
  }

  // Collect unique teacher IDs for name resolution
  const teacherIds = new Set<string>();
  for (const a of attendanceRecords) {
    teacherIds.add(a.lesson.teacherId);
  }
  for (const m of memberships) {
    if (m.trialTeacherId) teacherIds.add(m.trialTeacherId);
  }

  const teachers = teacherIds.size > 0
    ? await prisma.teacher.findMany({
        where: { id: { in: [...teacherIds] } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const teacherNameMap = new Map(
    teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]),
  );

  return memberships.map((m) => {
    const key = `${m.studentId}:${m.groupId}`;
    const att = attendanceLookup.get(key);
    const hasAttendance = att?.hasAttendance ?? false;

    // Derive trial status
    let status: "pending" | "committed" | "didnt_continue" | "no_show";
    if (m.isTrial && !m.leaveDate) {
      status = "pending";
    } else if (m.wasTrialOriginally && !m.isTrial && !m.leaveDate) {
      status = "committed";
    } else if (m.wasTrialOriginally && m.leaveDate && hasAttendance) {
      status = "didnt_continue";
    } else {
      status = "no_show";
    }

    const actualTeacherId = att?.actualTeacherId ?? m.trialTeacherId;

    return {
      id: m.id,
      student: m.student,
      group: m.group,
      joinDate: m.joinDate,
      status,
      actualTeacherName: actualTeacherId ? teacherNameMap.get(actualTeacherId) ?? null : null,
    };
  });
}

export async function getTeachers() {
  return prisma.teacher.findMany({
    where: { isActive: true },
    include: {
      groups: { where: { isActive: true }, select: { id: true, type: true } },
    },
    orderBy: { firstName: "asc" },
  });
}

export async function getAllTeachers(includeInactive = false) {
  return prisma.teacher.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      groups: { where: { isActive: true }, select: { id: true, type: true } },
    },
    orderBy: { firstName: "asc" },
  });
}

export async function getTeacherById(id: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      rateChanges: { orderBy: { effectiveFrom: "desc" }, include: { changedBy: { select: { firstName: true, lastName: true } } } },
      groups: {
        where: { isActive: true },
        select: {
          id: true,
          publicId: true,
          type: true,
          level: true,
          days: true,
          startTime: true,
          memberships: { where: { leaveDate: null }, select: { id: true } },
        },
      },
      deactivatedBy: { select: { firstName: true, lastName: true } },
    },
  });

  return teacher;
}

export type TeacherDocumentRecord = Awaited<ReturnType<typeof getTeacherDocuments>>[number];

/** Max teacher rate caps based on current PriceSetting values */
export async function getCurrentPriceLimits() {
  const now = new Date();
  const settings = await prisma.priceSetting.findMany({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
  });

  const seen = new Set<string>();
  let maxGroupRate = 0;
  let maxIndividualRate = 0;

  for (const s of settings) {
    const key = `${s.levelCategory}:${s.groupType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (s.groupType === "GROUP") maxGroupRate = Math.max(maxGroupRate, s.pricePerLesson);
    else maxIndividualRate = Math.max(maxIndividualRate, s.pricePerLesson);
  }

  if (maxGroupRate === 0 && maxIndividualRate === 0) return null;
  return { maxGroupRate, maxIndividualRate };
}

export async function getTeacherDocuments(teacherId: string) {
  return prisma.teacherDocument.findMany({
    where: { teacherId },
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { uploadedAt: "desc" },
  });
}
