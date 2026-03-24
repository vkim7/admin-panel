import { prisma } from "@/server/db";

export async function getStudents() {
  return prisma.student.findMany({
    include: {
      family: { select: { id: true, parentFirstName: true, parentLastName: true, parentPhone: true } },
      groupMemberships: {
        where: { leaveDate: null },
        select: {
          id: true,
          group: { select: { id: true, publicId: true, type: true, level: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getStudentById(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      family: true,
      lostReason: true,
      activatedBy: { select: { firstName: true, lastName: true } },
      inactivatedBy: { select: { firstName: true, lastName: true } },
      groupMemberships: {
        orderBy: { joinDate: "desc" },
        include: {
          group: {
            select: {
              id: true,
              publicId: true,
              type: true,
              level: true,
              days: true,
              startTime: true,
              isActive: true,
              mergedIntoGroupId: true,
              mergedIntoGroup: { select: { id: true, publicId: true } },
              graduatedIntoGroupId: true,
              graduatedIntoGroup: { select: { id: true, publicId: true } },
            },
          },
          transferReason: { select: { name: true, isOther: true } },
          continuedAsMemberships: {
            select: {
              group: { select: { id: true, publicId: true } },
            },
            take: 1,
          },
        },
      },
    },
  });
}

export async function getLostReasons() {
  return prisma.lostReason.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export type LostReason = Awaited<ReturnType<typeof getLostReasons>>[number];

export async function getUncertainStudents() {
  return prisma.student.findMany({
    where: {
      isUncertain: true,
      status: "ACTIVE",
    },
    include: {
      groupMemberships: {
        where: { leaveDate: null },
        select: {
          id: true,
          group: { select: { id: true, publicId: true, type: true, level: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUncertainCount() {
  return prisma.student.count({
    where: { isUncertain: true, status: "ACTIVE" },
  });
}

/** Count trial attempts per student per group type (for add-student dialog) */
export async function getTrialAttemptsForStudents(
  studentIds: string[],
): Promise<Record<string, { group: number; individual: number }>> {
  if (studentIds.length === 0) return {};

  const memberships = await prisma.groupMembership.findMany({
    where: {
      studentId: { in: studentIds },
      wasTrialOriginally: true,
    },
    select: {
      studentId: true,
      group: { select: { type: true } },
    },
  });

  const result: Record<string, { group: number; individual: number }> = {};
  for (const m of memberships) {
    const entry = result[m.studentId] ?? { group: 0, individual: 0 };
    if (m.group.type === "GROUP") {
      entry.group++;
    } else {
      entry.individual++;
    }
    result[m.studentId] = entry;
  }

  return result;
}

/**
 * For a set of trial memberships, check which ones have attendance records
 * scoped to the membership's date window (joinDate..leaveDate).
 * Returns a Set of membershipIds that have attendance.
 */
export async function getTrialMembershipAttendance(
  memberships: { id: string; studentId: string; groupId: string; joinDate: Date; leaveDate: Date | null }[],
): Promise<Set<string>> {
  if (memberships.length === 0) return new Set();

  const counts = await Promise.all(
    memberships.map((m) =>
      prisma.attendance.count({
        where: {
          studentId: m.studentId,
          groupId: m.groupId,
          lesson: {
            lessonDate: {
              gte: m.joinDate,
              ...(m.leaveDate ? { lte: m.leaveDate } : {}),
            },
          },
        },
      }),
    ),
  );

  const result = new Set<string>();
  for (let i = 0; i < memberships.length; i++) {
    if (counts[i]! > 0) result.add(memberships[i]!.id);
  }
  return result;
}

/** Students available for group assignment — excludes inactive and those already active in the given group */
export async function getStudentsForGroupAssignment(groupId: string) {
  return prisma.student.findMany({
    where: {
      status: { not: "INACTIVE" },
      groupMemberships: {
        none: {
          groupId,
          leaveDate: null,
        },
      },
    },
    select: {
      id: true,
      crmCode: true,
      firstName: true,
      lastName: true,
      status: true,
    },
    orderBy: { crmCode: "asc" },
  });
}
