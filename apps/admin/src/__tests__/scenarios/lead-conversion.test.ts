/**
 * Lead → Student conversion flow.
 *
 * Covers:
 * - Happy path: createStudent with leadId creates student with leadId set,
 *   flips lead to CONVERTED, and field mapping persists.
 * - Already-converted guard: cannot convert a CONVERTED lead.
 * - Duplicate-phone collision: existing student blocks conversion, lead stays
 *   in original status (transaction rollback).
 * - Concurrent conversion (P2002 on leadId unique index): exactly one wins.
 * - Conversion from LOST is allowed.
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
  createTestLead,
  expectRedirect,
} from "../helpers/factories";

const importStudents = () => import("@/lib/actions/students");

/** Form payload for createStudent. */
function studentData(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Converted",
    lastName: "Student",
    phone: `+998${Math.random().toString().slice(2, 11)}`,
    dateOfBirth: "2005-06-15",
    level: "BEGINNER",
    progressStage: "BEGINNING",
    preferredDays: [1, 3, 5],
    preferredTimeSlots: ["14:30"],
    preferredLanguage: "ANY",
    preferredLessonType: "GROUP",
    familyId: null,
    comment: null,
    promoCode: null,
    referredByCode: null,
    ...overrides,
  };
}

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

describe("lead conversion", () => {
  it("creates a student with leadId and flips the lead to CONVERTED", async () => {
    const { createStudent } = await importStudents();
    const lead = await createTestLead({
      firstName: "Aziz",
      lastName: "Karimov",
      phone: "+998901111111",
    });

    const url = await expectRedirect(() =>
      createStudent(
        studentData({
          firstName: "Aziz",
          lastName: "Karimov",
          phone: "+998901111111",
        }),
        "/reception",
        lead.id,
      ),
    );

    expect(url).toBe("/reception");

    const student = await prisma.student.findUnique({
      where: { phone: "+998901111111" },
    });
    expect(student).toBeTruthy();
    expect(student!.leadId).toBe(lead.id);

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead!.status).toBe("CONVERTED");
  });

  it("rejects conversion of an already-CONVERTED lead and creates no student", async () => {
    const { createStudent } = await importStudents();
    const lead = await createTestLead({ status: "CONVERTED" });

    const result = await createStudent(
      studentData({ phone: "+998902222222" }),
      "/reception",
      lead.id,
    );

    expect(result).toEqual({ error: expect.stringMatching(/already converted/i) });

    const studentCount = await prisma.student.count({
      where: { phone: "+998902222222" },
    });
    expect(studentCount).toBe(0);
  });

  it("rolls back when phone collides with an existing student — lead stays in original status", async () => {
    const { createStudent } = await importStudents();
    await createTestStudent({ phone: "+998903333333" });
    const lead = await createTestLead({
      phone: "+998903333333",
      status: "CONTACTED",
    });

    const result = await createStudent(
      studentData({ phone: "+998903333333" }),
      "/reception",
      lead.id,
    );

    expect(result).toEqual({ error: expect.stringMatching(/phone number/i) });

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead!.status).toBe("CONTACTED");
  });

  it("on concurrent conversion, exactly one student is created and the second attempt errors", async () => {
    const { createStudent } = await importStudents();
    const lead = await createTestLead({ status: "NEW" });

    const [resultA, resultB] = await Promise.allSettled([
      expectRedirect(() =>
        createStudent(
          studentData({ phone: "+998904444444" }),
          "/reception",
          lead.id,
        ),
      ),
      expectRedirect(() =>
        createStudent(
          studentData({ phone: "+998904444445" }),
          "/reception",
          lead.id,
        ),
      ),
    ]);

    const succeeded = [resultA, resultB].filter(
      (r) => r.status === "fulfilled",
    ).length;
    // Exactly one redirect succeeded; the other returned an {error} (no redirect)
    expect(succeeded).toBe(1);

    const students = await prisma.student.findMany({
      where: { leadId: lead.id },
    });
    expect(students).toHaveLength(1);

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead!.status).toBe("CONVERTED");
  });

  it("allows converting a LOST lead (lost = soft 'lost contact', not a hard block)", async () => {
    const { createStudent } = await importStudents();
    const lead = await createTestLead({ status: "LOST" });

    const url = await expectRedirect(() =>
      createStudent(
        studentData({ phone: "+998905555555" }),
        "/reception",
        lead.id,
      ),
    );

    expect(url).toBe("/reception");

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead!.status).toBe("CONVERTED");
  });
});
