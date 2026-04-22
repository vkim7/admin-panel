import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Auto-calculate endDate: before 15th → end of startMonth+2, after 15th → end of startMonth+3 */
function calculateEndDate(startDate: Date): Date {
  const day = startDate.getUTCDate();
  const monthsToAdd = day < 15 ? 3 : 4; // +2 or +3 months, then day 0 = last day of prev month
  const end = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + monthsToAdd, 0));
  return end;
}

/** Generate lesson dates from startDate to endDate for given ISO days, skipping holidays */
function generateLessonDates(
  startDate: Date,
  endDate: Date,
  days: number[],
  holidaySet: Set<string>
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    // JS getUTCDay: 0=Sun, 1=Mon... Convert to ISO: 1=Mon, 7=Sun
    const isoDay = current.getUTCDay() === 0 ? 7 : current.getUTCDay();
    const dateStr = current.toISOString().slice(0, 10);
    if (days.includes(isoDay) && !holidaySet.has(dateStr)) {
      dates.push(new Date(current));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/** Count lessons in a specific month from a list of lesson dates */
function countLessonsInMonth(dates: Date[], year: number, month: number): number {
  return dates.filter(d => d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month).length;
}

/** Find the next valid lesson date after a given date */
function findNextLessonDate(afterDate: Date, days: number[], holidaySet: Set<string>): Date {
  const current = new Date(afterDate);
  current.setUTCDate(current.getUTCDate() + 1);
  for (let i = 0; i < 30; i++) { // safety limit
    const isoDay = current.getUTCDay() === 0 ? 7 : current.getUTCDay();
    const dateStr = current.toISOString().slice(0, 10);
    if (days.includes(isoDay) && !holidaySet.has(dateStr)) {
      return new Date(current);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  throw new Error("Could not find next lesson date within 30 days");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding database...\n");

  // ─── Clean existing data (reverse dependency order) ───────────────────────
  await prisma.appliedPromotion.deleteMany();
  await prisma.studentPromotion.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.smsHistory.deleteMany();
  await prisma.callHistory.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.paymentPeriodAdjustment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.teacherPaymentPeriod.deleteMany();
  await prisma.studentPaymentPeriod.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.teacherScheduleSlot.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.groupTeacherHistory.deleteMany();
  await prisma.priceSetting.deleteMany();
  await prisma.group.deleteMany();
  await prisma.teacherRateChange.deleteMany();
  await prisma.teacherUnavailability.deleteMany();
  await prisma.teacherAvailability.deleteMany();
  await prisma.student.deleteMany();
  await prisma.family.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.transferReason.deleteMany();
  await prisma.lostReason.deleteMany();
  await prisma.cancellationReason.deleteMany();
  await prisma.holiday.deleteMany();

  // ─── Holidays (Uzbekistan 2026) ───────────────────────────────────────────
  const holidayData = [
    { date: "2026-01-01", name: "New Year" },
    { date: "2026-01-02", name: "New Year Holiday" },
    { date: "2026-01-03", name: "New Year Holiday" },
    { date: "2026-01-04", name: "New Year Holiday" },
    { date: "2026-03-07", name: "Women's Day Eve" },
    { date: "2026-03-08", name: "International Women's Day" },
    { date: "2026-03-09", name: "Women's Day Holiday" },
    { date: "2026-03-21", name: "Navruz" },
    { date: "2026-03-22", name: "Navruz / Eid al-Fitr" },
    { date: "2026-03-23", name: "Eid al-Fitr" },
    { date: "2026-05-09", name: "Day of Remembrance and Honour" },
    { date: "2026-05-10", name: "Day of Remembrance Holiday" },
    { date: "2026-05-11", name: "Day of Remembrance Holiday" },
    { date: "2026-05-28", name: "Eid al-Adha" },
    { date: "2026-05-29", name: "Eid al-Adha Holiday" },
    { date: "2026-05-30", name: "Eid al-Adha Holiday" },
    { date: "2026-05-31", name: "Eid al-Adha Holiday" },
    { date: "2026-08-29", name: "Independence Day Eve" },
    { date: "2026-08-30", name: "Independence Day Eve" },
    { date: "2026-08-31", name: "Independence Day" },
    { date: "2026-09-01", name: "Independence Day Holiday" },
    { date: "2026-12-08", name: "Constitution Day" },
    { date: "2026-12-31", name: "New Year 2027 Eve" },
  ];

  await Promise.all(
    holidayData.map(h =>
      prisma.holiday.create({ data: { date: new Date(h.date), name: h.name } })
    )
  );
  const holidaySet = new Set(holidayData.map(h => h.date));
  console.log(`Created ${holidayData.length} holidays`);

  // ─── Reference Tables ───────────────────────────────────────────────────
  const transferReasons = await Promise.all(
    [
      { name: "Teacher dissatisfaction", sortOrder: 1 },
      { name: "Classmates dissatisfaction", sortOrder: 2 },
      { name: "Level too low", sortOrder: 3 },
      { name: "Level too advanced", sortOrder: 4 },
      { name: "Failed mid exam", sortOrder: 5 },
      { name: "Other", isOther: true, sortOrder: 6 },
    ].map((r) => prisma.transferReason.create({ data: r }))
  );

  const lostReasons = await Promise.all(
    [
      { name: "Taking a break", sortOrder: 1 },
      { name: "Too expensive", sortOrder: 2 },
      { name: "Didn't like online format", sortOrder: 3 },
      { name: "Other", isOther: true, sortOrder: 4 },
      { name: "Trial no-show (Group)", sortOrder: 10 },
      { name: "Trial no-show — final attempt (Group)", sortOrder: 11 },
      { name: "Trial no-show (Individual)", sortOrder: 12 },
      { name: "Trial — didn't continue (Group)", sortOrder: 13 },
      { name: "Trial — didn't continue (Individual)", sortOrder: 14 },
    ].map((r) => prisma.lostReason.create({ data: r }))
  );

  const cancellationReasons = await Promise.all(
    [
      { name: "Teacher absence", sortOrder: 1 },
      { name: "Low attendance", sortOrder: 2 },
      { name: "Student request", sortOrder: 3 },
      { name: "Scheduling conflict", sortOrder: 4 },
      { name: "Administrative", sortOrder: 5 },
      { name: "Other", isOther: true, sortOrder: 6 },
    ].map((r) => prisma.cancellationReason.create({ data: r }))
  );

  console.log(
    `Created ${transferReasons.length} transfer reasons, ${lostReasons.length} lost reasons, ${cancellationReasons.length} cancellation reasons`
  );

  // ─── Admin User ───────────────────────────────────────────────────────────
  const admin = await prisma.adminUser.create({
    data: {
      telegramId: 511001n,
      firstName: "Vladimir",
      lastName: "Kim",
      role: "SUPER_ADMIN",
    },
  });

  const admin2 = await prisma.adminUser.create({
    data: {
      telegramId: 990254932n,
      firstName: "Laziz",
      lastName: "Islomkhujaev",
      role: "ADMIN",
    },
  });

  console.log(`Created admins: ${admin.firstName} (${admin.role}), ${admin2.firstName} (${admin2.role})`);

  // ─── Family ─────────────────────────────────────────────────────────────
  const leeFamily = await prisma.family.create({
    data: {
      name: "Lee family",
      parentFirstName: "Anvar",
      parentLastName: "Lee",
      parentPhone: "+998901000000",
    },
  });
  console.log(`Created family: ${leeFamily.name}`);

  // ─── Teachers ─────────────────────────────────────────────────────────────
  const teacher1 = await prisma.teacher.create({
    data: {
      firstName: "Aziza",
      lastName: "Karimova",
      phone: "+998901234567",
      levels: ["BEGINNER", "ELEMENTARY", "PRE_INTERMEDIATE"],
      teachingLanguage: "ANY",
      availability: {
        create: [
          { dayOfWeek: 1, startTime: "14:30", endTime: "22:00" },
          { dayOfWeek: 3, startTime: "14:30", endTime: "22:00" },
          { dayOfWeek: 5, startTime: "14:30", endTime: "22:00" },
          { dayOfWeek: 2, startTime: "17:30", endTime: "22:00" },
          { dayOfWeek: 4, startTime: "17:30", endTime: "22:00" },
          { dayOfWeek: 6, startTime: "17:30", endTime: "22:00" },
        ],
      },
    },
  });

  const teacher2 = await prisma.teacher.create({
    data: {
      firstName: "James",
      lastName: "Wilson",
      phone: "+998907654321",
      levels: ["INTERMEDIATE", "UPPER_INTERMEDIATE", "IELTS"],
      teachingLanguage: "RUSSIAN",
      availability: {
        create: [
          { dayOfWeek: 1, startTime: "17:30", endTime: "22:00" },
          { dayOfWeek: 3, startTime: "17:30", endTime: "22:00" },
          { dayOfWeek: 5, startTime: "17:30", endTime: "22:00" },
          { dayOfWeek: 2, startTime: "14:30", endTime: "22:00" },
          { dayOfWeek: 4, startTime: "14:30", endTime: "22:00" },
          { dayOfWeek: 6, startTime: "14:30", endTime: "22:00" },
        ],
      },
    },
  });

  console.log(`Created teachers: ${teacher1.firstName}, ${teacher2.firstName}`);

  // ─── Teacher Rate History ──────────────────────────────────────────────────
  const TEACHER1_GROUP_RATE = 5000;
  const TEACHER1_INDIVIDUAL_RATE = 15000;
  const TEACHER2_GROUP_RATE = 6000;
  const TEACHER2_INDIVIDUAL_RATE = 20000;

  await prisma.teacherRateChange.create({
    data: {
      teacherId: teacher1.id,
      groupLessonRate: TEACHER1_GROUP_RATE,
      individualLessonRate: TEACHER1_INDIVIDUAL_RATE,
      effectiveFrom: new Date("2025-01-01"),
      changedById: admin.id,
    },
  });

  await prisma.teacherRateChange.create({
    data: {
      teacherId: teacher2.id,
      groupLessonRate: TEACHER2_GROUP_RATE,
      individualLessonRate: TEACHER2_INDIVIDUAL_RATE,
      effectiveFrom: new Date("2025-01-01"),
      changedById: admin.id,
    },
  });

  console.log("Created teacher rate history");

  // ─── Groups (with auto-calculated endDate) ────────────────────────────────
  const gr1Start = new Date("2026-01-15");
  const gr1End = calculateEndDate(gr1Start); // Jan 15 → after 15th → end of Apr
  const group1 = await prisma.group.create({
    data: {
      publicId: "GR-1",
      type: "GROUP",
      teacherId: teacher1.id,
      days: [1, 3, 5],
      startTime: "14:30",
      level: "BEGINNER",
      progressStage: "MID",
      maxStudents: 6,
      startDate: gr1Start,
      endDate: gr1End,
    },
  });

  const gr2Start = new Date("2026-02-01");
  const gr2End = calculateEndDate(gr2Start); // Feb 1 → before 15th → end of Apr
  const group2 = await prisma.group.create({
    data: {
      publicId: "GR-2",
      type: "GROUP",
      teacherId: teacher1.id,
      days: [1, 3, 5],
      startTime: "16:00",
      level: "ELEMENTARY",
      progressStage: "BEGINNING",
      maxStudents: 6,
      startDate: gr2Start,
      endDate: gr2End,
    },
  });

  const gr3Start = new Date("2025-09-01");
  const gr3End = calculateEndDate(gr3Start); // Sep 1 → before 15th → end of Nov
  const group3 = await prisma.group.create({
    data: {
      publicId: "GR-3",
      type: "GROUP",
      teacherId: teacher2.id,
      days: [1, 3, 5],
      startTime: "17:30",
      level: "INTERMEDIATE",
      progressStage: "FINAL",
      maxStudents: 6,
      startDate: gr3Start,
      endDate: gr3End,
    },
  });

  console.log(
    `Created groups: ${group1.publicId} (${gr1Start.toISOString().slice(0,10)} → ${gr1End.toISOString().slice(0,10)}), ` +
    `${group2.publicId} (${gr2Start.toISOString().slice(0,10)} → ${gr2End.toISOString().slice(0,10)}), ` +
    `${group3.publicId} (${gr3Start.toISOString().slice(0,10)} → ${gr3End.toISOString().slice(0,10)})`
  );

  // ─── Individual Lesson (as unified Group with type INDIVIDUAL) ─────────────
  const indStudent = await prisma.student.create({
    data: {
      crmCode: "1",
      firstName: "Sardor",
      lastName: "Alimov",
      phone: "+998901111111",
      dateOfBirth: new Date("1998-05-15"),
      level: "UPPER_INTERMEDIATE",
      progressStage: "BEGINNING",
      status: "ACTIVE",
      preferredLanguage: "ANY",
    },
  });

  const indStart = new Date("2026-02-01");
  const indEnd = calculateEndDate(indStart); // Feb 1 → before 15th → end of Apr
  const indGroup = await prisma.group.create({
    data: {
      publicId: "IND-1",
      type: "INDIVIDUAL",
      teacherId: teacher2.id,
      days: [2, 4, 6],
      startTime: "14:30",
      level: "UPPER_INTERMEDIATE",
      progressStage: "BEGINNING",
      maxStudents: 1,
      startDate: indStart,
      endDate: indEnd,
    },
  });

  // ─── Global Price Settings ──────────────────────────────────────────────────
  // 4 price points: (GENERAL|IELTS) × (GROUP|INDIVIDUAL)
  const GENERAL_GROUP_PRICE = 47500;
  const GENERAL_INDIVIDUAL_PRICE = 200000;
  const IELTS_GROUP_PRICE = 47500;
  const IELTS_INDIVIDUAL_PRICE = 200000;

  await prisma.priceSetting.createMany({
    data: [
      { levelCategory: "GENERAL", groupType: "GROUP", pricePerLesson: GENERAL_GROUP_PRICE, effectiveFrom: new Date("2025-01-01"), changedById: admin.id },
      { levelCategory: "GENERAL", groupType: "INDIVIDUAL", pricePerLesson: GENERAL_INDIVIDUAL_PRICE, effectiveFrom: new Date("2025-01-01"), changedById: admin.id },
      { levelCategory: "IELTS", groupType: "GROUP", pricePerLesson: IELTS_GROUP_PRICE, effectiveFrom: new Date("2025-01-01"), changedById: admin.id },
      { levelCategory: "IELTS", groupType: "INDIVIDUAL", pricePerLesson: IELTS_INDIVIDUAL_PRICE, effectiveFrom: new Date("2025-01-01"), changedById: admin.id },
    ],
  });

  console.log("Created global price settings");

  // Individual students also use GroupMembership
  const indMembership = await prisma.groupMembership.create({
    data: {
      studentId: indStudent.id,
      groupId: indGroup.id,
      joinDate: indStart,
    },
  });

  console.log(
    `Created individual lesson: ${indGroup.publicId} for ${indStudent.firstName} (${indStart.toISOString().slice(0,10)} → ${indEnd.toISOString().slice(0,10)})`
  );

  // ─── Group Teacher History (initial assignments) ──────────────────────────
  await Promise.all([
    prisma.groupTeacherHistory.create({
      data: { groupId: group1.id, teacherId: teacher1.id, startDate: gr1Start },
    }),
    prisma.groupTeacherHistory.create({
      data: { groupId: group2.id, teacherId: teacher1.id, startDate: gr2Start },
    }),
    prisma.groupTeacherHistory.create({
      data: { groupId: group3.id, teacherId: teacher2.id, startDate: gr3Start },
    }),
    prisma.groupTeacherHistory.create({
      data: { groupId: indGroup.id, teacherId: teacher2.id, startDate: indStart },
    }),
  ]);
  console.log("Created initial group teacher history records");

  // ─── Active students (in groups) ────────────────────────────────────────
  const activeStudents = await Promise.all(
    [
      { crmCode: "2", firstName: "Malika", lastName: "Usmanova", phone: "+998902222222", dateOfBirth: new Date("2010-03-22"), level: "BEGINNER" as const, progressStage: "MID" as const, familyId: leeFamily.id, preferredLanguage: "UZBEK" as const },
      { crmCode: "3", firstName: "Bobur", lastName: "Tashpulatov", phone: "+998903333333", dateOfBirth: new Date("2000-11-08"), level: "BEGINNER" as const, progressStage: "MID" as const, preferredLanguage: "UZBEK" as const },
      { crmCode: "4", firstName: "Nilufar", lastName: "Rahimova", phone: "+998904444444", dateOfBirth: new Date("2001-07-14"), level: "BEGINNER" as const, progressStage: "MID" as const, preferredLanguage: "RUSSIAN" as const },
      { crmCode: "5", firstName: "Jamshid", lastName: "Kamolov", phone: "+998905555555", dateOfBirth: new Date("1999-01-30"), level: "ELEMENTARY" as const, progressStage: "BEGINNING" as const, preferredLanguage: "UZBEK" as const },
      { crmCode: "6", firstName: "Dilorom", lastName: "Saidova", phone: "+998906666666", dateOfBirth: new Date("2002-09-05"), level: "ELEMENTARY" as const, progressStage: "BEGINNING" as const, preferredLanguage: "RUSSIAN" as const },
      { crmCode: "7", firstName: "Rustam", lastName: "Mirzaev", phone: "+998907777777", dateOfBirth: new Date("1997-12-18"), level: "INTERMEDIATE" as const, progressStage: "FINAL" as const, preferredLanguage: "ANY" as const },
      { crmCode: "8", firstName: "Gulnora", lastName: "Abdullaeva", phone: "+998908888888", dateOfBirth: new Date("2003-06-25"), level: "INTERMEDIATE" as const, progressStage: "FINAL" as const, preferredLanguage: "ANY" as const },
      { crmCode: "9", firstName: "Otabek", lastName: "Nazarov", phone: "+998909999999", dateOfBirth: new Date("1995-04-10"), level: "INTERMEDIATE" as const, progressStage: "FINAL" as const, preferredLanguage: "ANY" as const },
    ].map((s) =>
      prisma.student.create({
        data: { ...s, status: "ACTIVE" },
      })
    )
  );

  console.log(`Created ${activeStudents.length} active students`);

  // ─── Group Memberships (store IDs for payment periods) ────────────────────
  const gr1Memberships = [];
  for (const student of activeStudents.slice(0, 3)) {
    const m = await prisma.groupMembership.create({
      data: { studentId: student.id, groupId: group1.id, joinDate: new Date("2026-01-15") },
    });
    gr1Memberships.push(m);
  }

  const gr2Memberships = [];
  for (const student of activeStudents.slice(3, 5)) {
    const m = await prisma.groupMembership.create({
      data: { studentId: student.id, groupId: group2.id, joinDate: new Date("2026-02-01") },
    });
    gr2Memberships.push(m);
  }

  const gr3Memberships = [];
  for (const student of activeStudents.slice(5, 8)) {
    const m = await prisma.groupMembership.create({
      data: { studentId: student.id, groupId: group3.id, joinDate: new Date("2025-09-01") },
    });
    gr3Memberships.push(m);
  }

  // Transfer example: Otabek was previously in GR-1 before transferring to GR-3
  const levelTooLow = transferReasons.find((r) => r.name === "Level too low")!;
  await prisma.groupMembership.create({
    data: {
      studentId: activeStudents[7].id,
      groupId: group1.id,
      joinDate: new Date("2025-09-01"),
      leaveDate: new Date("2025-12-01"),
      transferReasonId: levelTooLow.id,
      lessonsStart: 1,
      lessonsCompleted: 36,
    },
  });

  console.log("Created group memberships (including 1 transfer history)");

  // ─── Reception student (awaiting placement) ────────────────────────────
  const receptionStudent = await prisma.student.create({
    data: {
      crmCode: "10",
      firstName: "Shakhlo",
      lastName: "Yusupova",
      phone: "+998900000001",
      dateOfBirth: new Date("2004-08-12"),
      level: "PRE_INTERMEDIATE",
      progressStage: "BEGINNING",
      status: "AWAITING_ASSIGNMENT",
      preferredDays: [1, 3, 5],
      preferredTimeSlots: ["16:00", "17:30"],
      preferredLanguage: "RUSSIAN",
    },
  });

  await prisma.callHistory.create({
    data: {
      studentId: receptionStudent.id,
      calledById: admin.id,
      note: "Called to confirm placement test result. Student prefers MWF evenings.",
    },
  });

  console.log(`Created reception student: ${receptionStudent.firstName}`);

  // ─── Pre-create Lessons & Schedule Slots ──────────────────────────────────
  // "today" for determining COMPLETED vs SCHEDULED
  const today = new Date("2026-03-07");

  // Helper to create lessons + slots for a group (both GROUP and INDIVIDUAL types)
  async function createLessonsAndSlots(config: {
    groupId: string;
    teacherId: string;
    startTime: string;
    dates: Date[];
    activeStudentCount: number; // Snapshotted on COMPLETED lessons
  }) {
    const lessons = [];
    for (let i = 0; i < config.dates.length; i++) {
      const lessonDate = config.dates[i];
      const isPast = lessonDate < today;
      const lesson = await prisma.lesson.create({
        data: {
          groupId: config.groupId,
          teacherId: config.teacherId,
          originalTeacherId: config.teacherId, // Always set at creation = group teacher
          lessonNumber: i + 1,
          lessonDate,
          startTime: config.startTime,
          status: isPast ? "COMPLETED" : "SCHEDULED",
          activeStudentCount: isPast ? config.activeStudentCount : null,
          completedAt: isPast ? lessonDate : null, // Set when lesson is completed
        },
      });
      lessons.push(lesson);

      // Create matching schedule slot with direct lessonId link
      await prisma.teacherScheduleSlot.create({
        data: {
          teacherId: config.teacherId,
          date: lessonDate,
          startTime: config.startTime,
          groupId: config.groupId,
          lessonId: lesson.id,
        },
      });
    }
    return lessons;
  }

  // GR-1 lessons (3 active students)
  const gr1Dates = generateLessonDates(gr1Start, gr1End, [1, 3, 5], holidaySet);
  const gr1Lessons = await createLessonsAndSlots({
    groupId: group1.id,
    teacherId: teacher1.id,
    startTime: "14:30",
    dates: gr1Dates,
    activeStudentCount: 3,
  });
  console.log(`Created ${gr1Lessons.length} lessons + slots for GR-1`);

  // GR-2 lessons (2 active students)
  const gr2Dates = generateLessonDates(gr2Start, gr2End, [1, 3, 5], holidaySet);
  const gr2Lessons = await createLessonsAndSlots({
    groupId: group2.id,
    teacherId: teacher1.id,
    startTime: "16:00",
    dates: gr2Dates,
    activeStudentCount: 2,
  });
  console.log(`Created ${gr2Lessons.length} lessons + slots for GR-2`);

  // GR-3 lessons (3 active students)
  const gr3Dates = generateLessonDates(gr3Start, gr3End, [1, 3, 5], holidaySet);
  const gr3Lessons = await createLessonsAndSlots({
    groupId: group3.id,
    teacherId: teacher2.id,
    startTime: "17:30",
    dates: gr3Dates,
    activeStudentCount: 3,
  });
  console.log(`Created ${gr3Lessons.length} lessons + slots for GR-3`);

  // IND-1 lessons (1 active student)
  const indDates = generateLessonDates(indStart, indEnd, [2, 4, 6], holidaySet);
  const indLessons = await createLessonsAndSlots({
    groupId: indGroup.id,
    teacherId: teacher2.id,
    startTime: "14:30",
    dates: indDates,
    activeStudentCount: 1,
  });
  console.log(`Created ${indLessons.length} lessons + slots for IND-1`);

  // ─── Attendance (GR-1 completed lessons) ──────────────────────────────────
  // Pre-created for all active members with isAbsent = false, teacher marks absences
  const completedGr1 = gr1Lessons.filter(l => l.status === "COMPLETED");
  for (const lesson of completedGr1) {
    for (const student of activeStudents.slice(0, 3)) {
      const isAbsent =
        student.crmCode === "2" &&
        (lesson.lessonNumber === 3 || lesson.lessonNumber === 5);
      await prisma.attendance.create({
        data: {
          lessonId: lesson.id,
          studentId: student.id,
          groupId: group1.id,
          isAbsent,
        },
      });
    }
  }
  console.log(`Created attendance for ${completedGr1.length} completed GR-1 lessons`);

  // ─── Cancellation + Reschedule Example ────────────────────────────────────
  // Cancel the next scheduled GR-1 lesson and reschedule to end
  const teacherAbsence = cancellationReasons.find((r) => r.name === "Teacher absence")!;
  const nextScheduledGr1 = gr1Lessons.find(l => l.status === "SCHEDULED");
  if (nextScheduledGr1) {
    // Mark lesson as cancelled with reason and admin audit
    await prisma.lesson.update({
      where: { id: nextScheduledGr1.id },
      data: {
        status: "CANCELLED",
        cancelledAt: today,
        cancelledById: admin.id,
        cancellationReasonId: teacherAbsence.id,
      },
    });

    // Delete the cancelled lesson's schedule slot
    await prisma.teacherScheduleSlot.deleteMany({
      where: {
        lessonId: nextScheduledGr1.id,
      },
    });

    // Find next valid date after current endDate for replacement
    const replacementDate = findNextLessonDate(gr1End, [1, 3, 5], holidaySet);

    // Create replacement lesson
    // originalTeacherId = group teacher (same as all other lessons in this group)
    // originalLessonId always points to the FIRST lesson in the chain (the one that was billed).
    // For the first reschedule, that's the cancelled lesson itself.
    // If this replacement were later rescheduled again, the new replacement would copy this originalLessonId.
    const replacementLesson = await prisma.lesson.create({
      data: {
        groupId: group1.id,
        teacherId: teacher1.id,
        originalTeacherId: teacher1.id,
        lessonNumber: gr1Lessons.length + 1,
        lessonDate: replacementDate,
        startTime: "14:30",
        status: "SCHEDULED",
        rescheduledFromId: nextScheduledGr1.id,
        originalLessonId: nextScheduledGr1.id,
      },
    });

    // Create schedule slot for replacement with lessonId link
    await prisma.teacherScheduleSlot.create({
      data: {
        teacherId: teacher1.id,
        date: replacementDate,
        startTime: "14:30",
        groupId: group1.id,
        lessonId: replacementLesson.id,
      },
    });

    // Update group endDate to new last lesson date
    await prisma.group.update({
      where: { id: group1.id },
      data: { endDate: replacementDate },
    });

    console.log(
      `Cancelled GR-1 lesson #${nextScheduledGr1.lessonNumber} (${nextScheduledGr1.lessonDate.toISOString().slice(0, 10)}) → ` +
      `rescheduled as lesson #${replacementLesson.lessonNumber} (${replacementDate.toISOString().slice(0, 10)})`
    );
  }

  // ─── Substitute Example ───────────────────────────────────────────────────
  // Teacher2 substitutes for Teacher1 on the next scheduled GR-1 lesson (after the cancelled one)
  // originalTeacherId stays as teacher1 (set at creation) — only teacherId changes
  const nextAfterCancelled = gr1Lessons.find(
    l => l.status === "SCHEDULED" && l.id !== nextScheduledGr1?.id
  );
  if (nextAfterCancelled) {
    // Update lesson's teacher (originalTeacherId stays unchanged — it was set at creation)
    await prisma.lesson.update({
      where: { id: nextAfterCancelled.id },
      data: { teacherId: teacher2.id },
    });

    // Delete old schedule slot (find by lessonId — cleaner than matching by teacher+date+time)
    await prisma.teacherScheduleSlot.deleteMany({
      where: {
        lessonId: nextAfterCancelled.id,
      },
    });

    // Create new schedule slot (teacher2)
    await prisma.teacherScheduleSlot.create({
      data: {
        teacherId: teacher2.id,
        date: nextAfterCancelled.lessonDate,
        startTime: "14:30",
        groupId: group1.id,
        lessonId: nextAfterCancelled.id,
      },
    });

    console.log(
      `Substitute: GR-1 lesson #${nextAfterCancelled.lessonNumber} (${nextAfterCancelled.lessonDate.toISOString().slice(0, 10)}) → ` +
      `${teacher2.firstName} substitutes for ${teacher1.firstName}`
    );
  }

  // ─── Payment Periods (actual lesson counts per month) ─────────────────────
  // GR-1 students (3 students, each with their membership ID)
  for (let si = 0; si < 3; si++) {
    const student = activeStudents[si];
    const membership = gr1Memberships[si];

    const months = new Map<string, number>();
    for (const d of gr1Dates) {
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      months.set(key, (months.get(key) || 0) + 1);
    }

    for (const [key, count] of months) {
      const [year, month] = key.split("-").map(Number);
      const isFirstMonth = year === gr1Start.getUTCFullYear() && month === gr1Start.getUTCMonth() + 1;
      const isPastMonth = new Date(Date.UTC(year, month - 1, 1)) < today;
      const nilufar = student.crmCode === "4";
      const isPaid = !nilufar || !isPastMonth;

      await prisma.studentPaymentPeriod.create({
        data: {
          studentId: student.id,
          groupId: group1.id,
          groupMembershipId: membership.id,
          periodYear: year,
          periodMonth: month,
          totalLessons: count,
          pricePerLesson: GENERAL_GROUP_PRICE,
          amountDue: count * GENERAL_GROUP_PRICE,
          amountPaid: nilufar && isPastMonth ? 0 : isPastMonth ? count * GENERAL_GROUP_PRICE : 0,
          paymentStatus: !isPastMonth ? "UNPAID" : nilufar ? "UNPAID" : "PAID",
          isPartialPeriod: isFirstMonth && gr1Start.getUTCDate() > 1,
        },
      });
    }
  }

  // GR-2 students
  for (let si = 0; si < 2; si++) {
    const student = activeStudents[3 + si];
    const membership = gr2Memberships[si];

    const months = new Map<string, number>();
    for (const d of gr2Dates) {
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      months.set(key, (months.get(key) || 0) + 1);
    }

    for (const [key, count] of months) {
      const [year, month] = key.split("-").map(Number);
      const isFirstMonth = year === gr2Start.getUTCFullYear() && month === gr2Start.getUTCMonth() + 1;
      const isPastMonth = new Date(Date.UTC(year, month - 1, 1)) < today;

      await prisma.studentPaymentPeriod.create({
        data: {
          studentId: student.id,
          groupId: group2.id,
          groupMembershipId: membership.id,
          periodYear: year,
          periodMonth: month,
          totalLessons: count,
          pricePerLesson: GENERAL_GROUP_PRICE,
          amountDue: count * GENERAL_GROUP_PRICE,
          amountPaid: isPastMonth ? count * GENERAL_GROUP_PRICE : 0,
          paymentStatus: isPastMonth ? "PAID" : "UNPAID",
          isPartialPeriod: isFirstMonth && gr2Start.getUTCDate() > 1,
        },
      });
    }
  }

  // GR-3: Rustam fully paid for last month (Nov 2025)
  const gr3NovLessons = countLessonsInMonth(gr3Dates, 2025, 11);
  const partialPeriod = await prisma.studentPaymentPeriod.create({
    data: {
      studentId: activeStudents[5].id,
      groupId: group3.id,
      groupMembershipId: gr3Memberships[0].id,
      periodYear: 2025,
      periodMonth: 11,
      totalLessons: gr3NovLessons,
      pricePerLesson: GENERAL_GROUP_PRICE,
      amountDue: gr3NovLessons * GENERAL_GROUP_PRICE,
      amountPaid: gr3NovLessons * GENERAL_GROUP_PRICE,
      paymentStatus: "PAID",
      isPartialPeriod: false,
    },
  });

  await prisma.payment.create({
    data: {
      studentId: activeStudents[5].id,
      studentPaymentPeriodId: partialPeriod.id,
      amount: gr3NovLessons * GENERAL_GROUP_PRICE,
      paymentMethod: "click",
      recordedById: admin.id,
      note: "November payment",
    },
  });

  // IND-1: Sardor's payment periods
  const indMonths = new Map<string, number>();
  for (const d of indDates) {
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    indMonths.set(key, (indMonths.get(key) || 0) + 1);
  }

  for (const [key, count] of indMonths) {
    const [year, month] = key.split("-").map(Number);
    const isPastMonth = new Date(Date.UTC(year, month - 1, 1)) < today;

    await prisma.studentPaymentPeriod.create({
      data: {
        studentId: indStudent.id,
        groupId: indGroup.id,
        groupMembershipId: indMembership.id,
        periodYear: year,
        periodMonth: month,
        totalLessons: count,
        pricePerLesson: GENERAL_INDIVIDUAL_PRICE,
        amountDue: count * GENERAL_INDIVIDUAL_PRICE,
        amountPaid: isPastMonth ? count * GENERAL_INDIVIDUAL_PRICE : 0,
        paymentStatus: isPastMonth ? "PAID" : "UNPAID",
        isPartialPeriod: false,
      },
    });
  }

  console.log("Created payment periods and payment records");

  // ─── Teacher Payment Periods (processed on 1st of next month) ──────────────
  // By March 7, January and February payouts would be processed.
  // Generate teacher pay for completed months.

  // Helper: count completed lessons and total student-lessons for a group in a month
  function teacherPayForMonth(
    dates: Date[],
    year: number,
    month: number,
    activeCount: number,
    rate: number
  ): { lessonsCompleted: number; totalStudentLessons: number; amount: number } {
    const lessonsInMonth = dates.filter(
      d => d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d < today
    ).length;
    const totalStudentLessons = lessonsInMonth * activeCount;
    return {
      lessonsCompleted: lessonsInMonth,
      totalStudentLessons,
      amount: totalStudentLessons * rate,
    };
  }

  // Teacher1 — GR-1 (Jan, Feb completed; rate 5000/student-lesson, 3 students)
  for (const [year, month] of [[2026, 1], [2026, 2]] as const) {
    const pay = teacherPayForMonth(gr1Dates, year, month, 3, TEACHER1_GROUP_RATE);
    if (pay.lessonsCompleted > 0) {
      await prisma.teacherPaymentPeriod.create({
        data: {
          teacherId: teacher1.id,
          groupId: group1.id,
          periodYear: year,
          periodMonth: month,
          lessonsCompleted: pay.lessonsCompleted,
          totalStudentLessons: pay.totalStudentLessons,
          rate: TEACHER1_GROUP_RATE,
          amount: pay.amount,
          status: "UNPAID",
        },
      });
    }
  }

  // Teacher1 — GR-2 (Feb completed; rate 5000/student-lesson, 2 students)
  {
    const pay = teacherPayForMonth(gr2Dates, 2026, 2, 2, TEACHER1_GROUP_RATE);
    if (pay.lessonsCompleted > 0) {
      await prisma.teacherPaymentPeriod.create({
        data: {
          teacherId: teacher1.id,
          groupId: group2.id,
          periodYear: 2026,
          periodMonth: 2,
          lessonsCompleted: pay.lessonsCompleted,
          totalStudentLessons: pay.totalStudentLessons,
          rate: TEACHER1_GROUP_RATE,
          amount: pay.amount,
          status: "UNPAID",
        },
      });
    }
  }

  // Teacher2 — GR-3 (Sep, Oct, Nov 2025 all completed; rate 6000, 3 students)
  for (const [year, month] of [[2025, 9], [2025, 10], [2025, 11]] as const) {
    const pay = teacherPayForMonth(gr3Dates, year, month, 3, TEACHER2_GROUP_RATE);
    if (pay.lessonsCompleted > 0) {
      await prisma.teacherPaymentPeriod.create({
        data: {
          teacherId: teacher2.id,
          groupId: group3.id,
          periodYear: year,
          periodMonth: month,
          lessonsCompleted: pay.lessonsCompleted,
          totalStudentLessons: pay.totalStudentLessons,
          rate: TEACHER2_GROUP_RATE,
          amount: pay.amount,
          status: "UNPAID",
        },
      });
    }
  }

  // Teacher2 — IND-1 (Feb completed; rate 20000, 1 student)
  {
    const pay = teacherPayForMonth(indDates, 2026, 2, 1, TEACHER2_INDIVIDUAL_RATE);
    if (pay.lessonsCompleted > 0) {
      await prisma.teacherPaymentPeriod.create({
        data: {
          teacherId: teacher2.id,
          groupId: indGroup.id,
          periodYear: 2026,
          periodMonth: 2,
          lessonsCompleted: pay.lessonsCompleted,
          totalStudentLessons: pay.totalStudentLessons,
          rate: TEACHER2_INDIVIDUAL_RATE,
          amount: pay.amount,
          status: "UNPAID",
        },
      });
    }
  }

  console.log("Created teacher payment periods");

  // ─── Uncertain student flag ─────────────────────────────────────────────
  await prisma.student.update({
    where: { id: activeStudents[1].id },
    data: {
      isUncertain: true,
      uncertainFlaggedBy: "TEACHER",
      uncertainComment: "Struggling with basics, might need to move to a lower level",
    },
  });
  console.log("Flagged Bobur as uncertain");

  // ─── Exam ───────────────────────────────────────────────────────────────
  await prisma.exam.create({
    data: {
      groupId: group3.id,
      type: "FINAL",
      scheduledDate: new Date("2026-03-15"),
      comment: "Final exam for Intermediate group",
    },
  });
  console.log("Created final exam for GR-3");

  // ─── Phase 11: Additional seed data for merge, graduation, and refund testing ──

  // --- GR-4: Small Beginner group (same level as GR-1, for merge testing) ---
  const gr4Students = await Promise.all(
    [
      { crmCode: "11", firstName: "Zarina", lastName: "Ergasheva", phone: "+998901100011", dateOfBirth: new Date("2001-04-20"), level: "BEGINNER" as const, progressStage: "MID" as const, preferredLanguage: "UZBEK" as const },
      { crmCode: "12", firstName: "Davron", lastName: "Khamidov", phone: "+998901200012", dateOfBirth: new Date("2003-10-05"), level: "BEGINNER" as const, progressStage: "MID" as const, preferredLanguage: "ANY" as const },
    ].map((s) => prisma.student.create({ data: { ...s, status: "ACTIVE" } }))
  );

  const gr4Start = new Date("2026-01-19"); // Mon, slightly after GR-1
  const gr4End = calculateEndDate(gr4Start); // Jan 19 → after 15th → end of May
  const group4 = await prisma.group.create({
    data: {
      publicId: "GR-4",
      type: "GROUP",
      teacherId: teacher1.id,
      days: [2, 4, 6], // TTS — different days from GR-1 (MWF) so no schedule conflicts on merge
      startTime: "14:30",
      level: "BEGINNER",
      progressStage: "MID",
      maxStudents: 6,
      startDate: gr4Start,
      endDate: gr4End,
    },
  });

  await prisma.groupTeacherHistory.create({
    data: { groupId: group4.id, teacherId: teacher1.id, startDate: gr4Start },
  });

  // Create lessons + slots for GR-4
  const gr4Dates = generateLessonDates(gr4Start, gr4End, [2, 4, 6], holidaySet);
  const gr4Lessons = await createLessonsAndSlots({
    groupId: group4.id,
    teacherId: teacher1.id,
    startTime: "14:30",
    dates: gr4Dates,
    activeStudentCount: 2,
  });
  console.log(`Created ${gr4Lessons.length} lessons + slots for GR-4`);

  // Memberships for GR-4
  const gr4Memberships = [];
  for (const student of gr4Students) {
    const m = await prisma.groupMembership.create({
      data: { studentId: student.id, groupId: group4.id, joinDate: gr4Start },
    });
    gr4Memberships.push(m);
  }

  // Payment periods for GR-4 students
  for (let si = 0; si < 2; si++) {
    const student = gr4Students[si];
    const membership = gr4Memberships[si];

    const months = new Map<string, number>();
    for (const d of gr4Dates) {
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      months.set(key, (months.get(key) || 0) + 1);
    }

    for (const [key, count] of months) {
      const [year, month] = key.split("-").map(Number);
      const isFirstMonth = year === gr4Start.getUTCFullYear() && month === gr4Start.getUTCMonth() + 1;
      const isPastMonth = new Date(Date.UTC(year, month - 1, 1)) < today;

      await prisma.studentPaymentPeriod.create({
        data: {
          studentId: student.id,
          groupId: group4.id,
          groupMembershipId: membership.id,
          periodYear: year,
          periodMonth: month,
          totalLessons: count,
          pricePerLesson: GENERAL_GROUP_PRICE,
          amountDue: count * GENERAL_GROUP_PRICE,
          amountPaid: isPastMonth ? count * GENERAL_GROUP_PRICE : 0,
          paymentStatus: isPastMonth ? "PAID" : "UNPAID",
          isPartialPeriod: isFirstMonth && gr4Start.getUTCDate() > 1,
        },
      });
    }
  }

  // Attendance for GR-4 completed lessons
  const completedGr4 = gr4Lessons.filter(l => l.status === "COMPLETED");
  for (const lesson of completedGr4) {
    for (const student of gr4Students) {
      await prisma.attendance.create({
        data: {
          lessonId: lesson.id,
          studentId: student.id,
          groupId: group4.id,
          isAbsent: false,
        },
      });
    }
  }

  console.log(`Created GR-4 (Beginner TTS) with ${gr4Students.length} students — merge candidate for GR-1`);

  // --- GR-5: Another small Beginner group (1 student, for merge testing edge case) ---
  const gr5Student = await prisma.student.create({
    data: {
      crmCode: "13",
      firstName: "Kamola",
      lastName: "Rakhimova",
      phone: "+998901300013",
      dateOfBirth: new Date("2000-07-18"),
      level: "BEGINNER",
      progressStage: "MID",
      status: "ACTIVE",
      preferredLanguage: "ANY",
    },
  });

  const gr5Start = new Date("2026-02-02"); // Mon
  const gr5End = calculateEndDate(gr5Start);
  const group5 = await prisma.group.create({
    data: {
      publicId: "GR-5",
      type: "GROUP",
      teacherId: teacher1.id,
      days: [1, 3, 5], // MWF — same days as GR-1 but different time
      startTime: "17:30",
      level: "BEGINNER",
      progressStage: "BEGINNING",
      maxStudents: 6,
      startDate: gr5Start,
      endDate: gr5End,
    },
  });

  await prisma.groupTeacherHistory.create({
    data: { groupId: group5.id, teacherId: teacher1.id, startDate: gr5Start },
  });

  const gr5Dates = generateLessonDates(gr5Start, gr5End, [1, 3, 5], holidaySet);
  const gr5Lessons = await createLessonsAndSlots({
    groupId: group5.id,
    teacherId: teacher1.id,
    startTime: "17:30",
    dates: gr5Dates,
    activeStudentCount: 1,
  });

  const gr5Membership = await prisma.groupMembership.create({
    data: { studentId: gr5Student.id, groupId: group5.id, joinDate: gr5Start },
  });

  // Payment periods for GR-5
  const gr5Months = new Map<string, number>();
  for (const d of gr5Dates) {
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    gr5Months.set(key, (gr5Months.get(key) || 0) + 1);
  }
  for (const [key, count] of gr5Months) {
    const [year, month] = key.split("-").map(Number);
    const isPastMonth = new Date(Date.UTC(year, month - 1, 1)) < today;
    await prisma.studentPaymentPeriod.create({
      data: {
        studentId: gr5Student.id,
        groupId: group5.id,
        groupMembershipId: gr5Membership.id,
        periodYear: year,
        periodMonth: month,
        totalLessons: count,
        pricePerLesson: GENERAL_GROUP_PRICE,
        amountDue: count * GENERAL_GROUP_PRICE,
        amountPaid: isPastMonth ? count * GENERAL_GROUP_PRICE : 0,
        paymentStatus: isPastMonth ? "PAID" : "UNPAID",
        isPartialPeriod: false,
      },
    });
  }

  console.log(`Created GR-5 (Beginner MWF 17:30) with 1 student — another merge candidate`);

  // --- Complete GR-3 billing data (for graduation testing) ---
  // GR-3 has 3 students (Rustam, Gulnora, Otabek) from Sep-Nov 2025.
  // Rustam already has Nov data. Add Sep+Oct for Rustam, and all months for Gulnora+Otabek.
  for (const [year, month] of [[2025, 9], [2025, 10]] as [number, number][]) {
    const lessonsInMonth = countLessonsInMonth(gr3Dates, year, month);
    if (lessonsInMonth === 0) continue;
    await prisma.studentPaymentPeriod.create({
      data: {
        studentId: activeStudents[5].id, // Rustam
        groupId: group3.id,
        groupMembershipId: gr3Memberships[0].id,
        periodYear: year,
        periodMonth: month,
        totalLessons: lessonsInMonth,
        pricePerLesson: GENERAL_GROUP_PRICE,
        amountDue: lessonsInMonth * GENERAL_GROUP_PRICE,
        amountPaid: lessonsInMonth * GENERAL_GROUP_PRICE,
        paymentStatus: "PAID",
        isPartialPeriod: false,
      },
    });
  }

  // Gulnora (index 6) and Otabek (index 7) — all 3 months
  for (const si of [1, 2]) {
    const student = activeStudents[5 + si];
    const membership = gr3Memberships[si];
    for (const [year, month] of [[2025, 9], [2025, 10], [2025, 11]] as [number, number][]) {
      const lessonsInMonth = countLessonsInMonth(gr3Dates, year, month);
      if (lessonsInMonth === 0) continue;
      await prisma.studentPaymentPeriod.create({
        data: {
          studentId: student.id,
          groupId: group3.id,
          groupMembershipId: membership.id,
          periodYear: year,
          periodMonth: month,
          totalLessons: lessonsInMonth,
          pricePerLesson: GENERAL_GROUP_PRICE,
          amountDue: lessonsInMonth * GENERAL_GROUP_PRICE,
          amountPaid: lessonsInMonth * GENERAL_GROUP_PRICE,
          paymentStatus: "PAID",
          isPartialPeriod: false,
        },
      });
    }
  }

  // GR-3 attendance (all completed lessons)
  const completedGr3 = gr3Lessons.filter(l => l.status === "COMPLETED");
  for (const lesson of completedGr3) {
    for (const student of activeStudents.slice(5, 8)) {
      await prisma.attendance.create({
        data: {
          lessonId: lesson.id,
          studentId: student.id,
          groupId: group3.id,
          isAbsent: false,
        },
      });
    }
  }

  console.log("Completed GR-3 billing and attendance data (graduation-ready)");

  // --- Pending Refund (for refund management testing) ---
  // Simulate a residual transfer credit refund for Otabek (he was previously in GR-1 before GR-3)
  const otabekGr3Period = await prisma.studentPaymentPeriod.findFirst({
    where: { studentId: activeStudents[7].id, groupId: group3.id },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });

  if (otabekGr3Period) {
    await prisma.refund.create({
      data: {
        studentId: activeStudents[7].id,
        studentPaymentPeriodId: otabekGr3Period.id,
        amount: 75000, // 3 lessons worth of credit that couldn't be absorbed
        status: "PENDING",
        initiatedById: admin.id,
        note: "Residual transfer credit from GR-1 — exceeded destination billing",
      },
    });
    console.log("Created pending refund for Otabek (75,000 UZS)");
  }

  // --- Another pending refund for Zarina (GR-4) ---
  const zarinaGr4Period = await prisma.studentPaymentPeriod.findFirst({
    where: { studentId: gr4Students[0].id, groupId: group4.id },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });

  if (zarinaGr4Period) {
    await prisma.refund.create({
      data: {
        studentId: gr4Students[0].id,
        studentPaymentPeriodId: zarinaGr4Period.id,
        amount: 50000, // 2 lessons worth
        status: "PENDING",
        initiatedById: admin.id,
        note: "Overpayment from schedule change adjustment",
      },
    });
    console.log("Created pending refund for Zarina (50,000 UZS)");
  }

  // --- A completed refund (for display testing) ---
  const rustamGr3Period = await prisma.studentPaymentPeriod.findFirst({
    where: { studentId: activeStudents[5].id, groupId: group3.id },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
  });

  if (rustamGr3Period) {
    await prisma.refund.create({
      data: {
        studentId: activeStudents[5].id,
        studentPaymentPeriodId: rustamGr3Period.id,
        amount: 25000,
        amountRefunded: 25000,
        status: "COMPLETED",
        paymentMethod: "cash",
        initiatedById: admin.id,
        processedById: admin2.id,
        processedAt: new Date("2025-12-15"),
        note: "Processed refund from earlier transfer",
      },
    });
    console.log("Created completed refund for Rustam (25,000 UZS)");
  }

  console.log("\n── Phase 11 Seed Summary ──");
  console.log("  GR-3: Graduation-ready (Intermediate → Upper-Intermediate, all lessons COMPLETED)");
  console.log("  GR-4: Merge candidate (Beginner TTS, 2 students → can merge into GR-1 MWF)");
  console.log("  GR-5: Merge candidate (Beginner MWF 17:30, 1 student)");
  console.log("  Refunds: 2 PENDING + 1 COMPLETED");

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 12: Promotions & Referrals — System Promotions
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n═══ Phase 12: Seeding Promotions & Referrals ═══\n");

  // System promotions: Trial discounts (GROUP = 100% free, INDIVIDUAL = 50% off)
  const trialGroupPromo = await prisma.promotion.create({
    data: {
      name: "Trial Group Free Lesson",
      type: "TRIAL",
      discountType: "PERCENTAGE",
      discountPercent: 100,
      groupTypes: ["GROUP"],
      isRecurring: false,
      maxUsesPerStudent: 1,
      isActive: true,
    },
  });
  console.log(`Created TRIAL promotion: ${trialGroupPromo.name}`);

  const trialIndividualPromo = await prisma.promotion.create({
    data: {
      name: "Trial Individual 50%",
      type: "TRIAL",
      discountType: "PERCENTAGE",
      discountPercent: 50,
      groupTypes: ["INDIVIDUAL"],
      isRecurring: false,
      maxUsesPerStudent: 1,
      isActive: true,
    },
  });
  console.log(`Created TRIAL promotion: ${trialIndividualPromo.name}`);

  // Referral reward promotions
  const referrerReward = await prisma.promotion.create({
    data: {
      name: "Referral Reward",
      type: "REFERRAL",
      discountType: "FIXED_AMOUNT",
      discountAmount: 70000,
      isRecurring: false,
      maxUsesPerStudent: 1,
      isActive: true,
    },
  });
  console.log(`Created referral reward promotion: ${referrerReward.name} (70,000 UZS)`);

  const referredReward = await prisma.promotion.create({
    data: {
      name: "Referral Welcome",
      type: "REFERRAL",
      discountType: "FIXED_AMOUNT",
      discountAmount: 70000,
      isRecurring: false,
      maxUsesPerStudent: 1,
      isActive: true,
    },
  });
  console.log(`Created referred welcome promotion: ${referredReward.name} (70,000 UZS)`);

  // Family discount (recurring, indefinite)
  await prisma.promotion.create({
    data: {
      name: "Family Discount",
      type: "FAMILY",
      discountType: "FIXED_AMOUNT",
      discountAmount: 70000,
      isRecurring: true,
      isActive: true,
    },
  });
  console.log("Created FAMILY promotion: Family Discount (70,000 UZS, recurring)");

  // Win-Back discount (one-time)
  await prisma.promotion.create({
    data: {
      name: "Win-Back Discount",
      type: "WIN_BACK",
      discountType: "FIXED_AMOUNT",
      discountAmount: 70000,
      isRecurring: false,
      maxUsesPerStudent: 1,
      isActive: true,
    },
  });
  console.log("Created WIN_BACK promotion: Win-Back Discount (70,000 UZS)");

  // Apology discount (one-time, admin-applied)
  await prisma.promotion.create({
    data: {
      name: "Apology Discount",
      type: "APOLOGY",
      discountType: "FIXED_AMOUNT",
      discountAmount: 70000,
      isRecurring: false,
      isActive: true,
    },
  });
  console.log("Created APOLOGY promotion: Apology Discount (70,000 UZS)");

  // Reward discount (one-time, admin-applied)
  await prisma.promotion.create({
    data: {
      name: "Reward Discount",
      type: "REWARD",
      discountType: "FIXED_AMOUNT",
      discountAmount: 70000,
      isRecurring: false,
      isActive: true,
    },
  });
  console.log("Created REWARD promotion: Reward Discount (70,000 UZS)");

  // Generate referral codes for existing students
  for (const s of activeStudents) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    await prisma.student.update({
      where: { id: s.id },
      data: { referralCode: code },
    });
  }
  console.log(`Generated referral codes for ${activeStudents.length} students`);

  // Sample referral: Alisher referred Sardor
  await prisma.referral.create({
    data: {
      referrerStudentId: activeStudents[0]!.id, // Alisher
      referredStudentId: activeStudents[1]!.id, // Sardor
      status: "COMPLETED",
      completedAt: new Date("2026-02-15"),
    },
  });
  console.log("Created sample referral: Alisher → Sardor (COMPLETED)");

  console.log("\n── Phase 12 Seed Summary ──");
  console.log("  System promotions: Trial Group 100%, Trial Individual 50%, Referral Reward 100k, Referral Welcome 100k, Family 100k, Win-Back 100k, Apology 100k, Reward 100k");
  console.log("  Referral codes generated for all active students");
  console.log("  Sample referral: Alisher → Sardor (COMPLETED)");

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n═══ Verifying Admin Panel View Queries ═══\n");

  // ── Lesson counts per group ───────────────────────────────────────────
  console.log("── Lesson Counts ──");
  for (const [label, dates] of [["GR-1", gr1Dates], ["GR-2", gr2Dates], ["GR-3", gr3Dates], ["IND-1", indDates]] as const) {
    const months = new Map<string, number>();
    for (const d of dates) {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      months.set(key, (months.get(key) || 0) + 1);
    }
    const breakdown = [...months.entries()].sort().map(([m, c]) => `${m}: ${c}`).join(", ");
    console.log(`  ${label}: ${dates.length} total — ${breakdown}`);
  }

  // ── Cancelled/Rescheduled lesson ────────────────────────────────────────
  const cancelledLessons = await prisma.lesson.findMany({
    where: { status: "CANCELLED" },
    include: { rescheduledTo: true, cancellationReason: true },
  });
  console.log("\n── Cancelled Lessons ──");
  for (const l of cancelledLessons) {
    console.log(
      `  Lesson #${l.lessonNumber} (${l.lessonDate.toISOString().slice(0, 10)}) → CANCELLED (${l.cancellationReason?.name ?? "no reason"})` +
      (l.rescheduledTo ? ` → rescheduled to #${l.rescheduledTo.lessonNumber} (${l.rescheduledTo.lessonDate.toISOString().slice(0, 10)})` : "")
    );
  }

  // ── Substitute lessons (detected by teacherId != originalTeacherId) ────
  const substituteLessons = await prisma.lesson.findMany({
    where: {
      groupId: group1.id,
      status: { not: "CANCELLED" },
      NOT: {
        teacherId: { equals: prisma.lesson.fields?.originalTeacherId as any }, // Prisma doesn't support field-to-field comparison directly
      },
    },
    include: { teacher: true, originalTeacher: true },
  });
  // Since Prisma doesn't support cross-column comparison, filter in JS
  const allGr1Lessons = await prisma.lesson.findMany({
    where: { groupId: group1.id, status: { not: "CANCELLED" } },
    include: { teacher: true, originalTeacher: true },
  });
  const actualSubstitutes = allGr1Lessons.filter(l => l.teacherId !== l.originalTeacherId);
  console.log("\n── Substitute Lessons ──");
  for (const l of actualSubstitutes) {
    console.log(
      `  GR-1 Lesson #${l.lessonNumber} (${l.lessonDate.toISOString().slice(0, 10)}) → taught by ${l.teacher.firstName} ${l.teacher.lastName} (originally ${l.originalTeacher.firstName} ${l.originalTeacher.lastName})`
    );
  }

  // ── Main Schedule (unified — both GROUP and INDIVIDUAL) ───────────────
  const mainSchedule = await prisma.teacher.findMany({
    where: { isActive: true },
    include: {
      groups: {
        where: { isActive: true },
        include: {
          memberships: { where: { leaveDate: null } },
        },
      },
      scheduleSlots: {
        where: {
          date: { gte: new Date("2026-03-07"), lte: new Date("2026-03-13") },
        },
      },
    },
  });

  console.log("\n── Main Schedule (week of Mar 7) ──");
  for (const t of mainSchedule) {
    console.log(`  ${t.firstName} ${t.lastName}: ${t.scheduleSlots.length} slots this week`);
    for (const g of t.groups) {
      const currentStudents = g.memberships.length;
      const typeLabel = g.type === "INDIVIDUAL" ? "IND" : "GR";
      console.log(
        `    ${g.publicId} [${typeLabel}] | ${g.days.join(",")} ${g.startTime} | ${g.level} ${g.progressStage.toLowerCase()} | ${currentStudents}/${g.maxStudents} seats | ends ${g.endDate.toISOString().slice(0, 10)}`
      );
    }
  }

  // ── No Payment List ─────────────────────────────────────────────────────
  const noPayment = await prisma.studentPaymentPeriod.findMany({
    where: {
      paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
    },
    include: { student: true, group: true },
  });

  console.log("\n── No Payment List (all unpaid/partial) ──");
  for (const pp of noPayment) {
    console.log(
      `  ${pp.student.crmCode} ${pp.student.firstName} ${pp.student.lastName} | ${pp.group.publicId} | ${pp.periodYear}-${String(pp.periodMonth).padStart(2, "0")} | ${pp.paymentStatus} | Due: ${pp.amountDue} Paid: ${pp.amountPaid} (${pp.totalLessons} lessons)`
    );
  }

  // ── Teacher Management ──────────────────────────────────────────────────
  const teacherMgmt = await prisma.teacher.findMany({
    where: { isActive: true },
    include: {
      scheduleSlots: true,
      groups: { where: { isActive: true } },
    },
  });

  console.log("\n── Teacher Management ──");
  for (const t of teacherMgmt) {
    const groupCount = t.groups.filter(g => g.type === "GROUP").length;
    const indCount = t.groups.filter(g => g.type === "INDIVIDUAL").length;
    console.log(
      `  ${t.firstName} ${t.lastName} | Levels: ${t.levels.join(", ")} | Total slots: ${t.scheduleSlots.length} | Groups: ${groupCount} | Individual: ${indCount}`
    );
  }

  // ── Teacher Payment Summary ──────────────────────────────────────────────
  const teacherPay = await prisma.teacherPaymentPeriod.findMany({
    include: { teacher: true, group: true },
    orderBy: [{ teacherId: "asc" }, { periodYear: "asc" }, { periodMonth: "asc" }],
  });

  console.log("\n── Teacher Payment Periods ──");
  for (const tp of teacherPay) {
    console.log(
      `  ${tp.teacher.firstName} | ${tp.group.publicId} | ${tp.periodYear}-${String(tp.periodMonth).padStart(2, "0")} | ${tp.lessonsCompleted} lessons × ${tp.totalStudentLessons} student-lessons @ ${tp.rate} = ${tp.amount} UZS | ${tp.status}`
    );
  }

  console.log("\n═══ Seed complete ═══");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
