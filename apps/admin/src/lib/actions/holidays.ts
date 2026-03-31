"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { createHolidaySchema } from "@/schemas/holiday";
import { cancelLessonsForHoliday } from "@/lib/helpers/holiday-billing";
import { getUzbekistanToday } from "@/lib/helpers/date";

export async function createHoliday(data: unknown) {
  const admin = await requireAdmin();
  const parsed = createHolidaySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { name, date } = parsed.data;
  const holidayDate = new Date(date + "T00:00:00Z");

  // Must be strictly future
  const today = getUzbekistanToday();
  if (holidayDate <= today) {
    return { error: "Holiday date must be in the future" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.holiday.create({
        data: { name, date: holidayDate },
      });

      return cancelLessonsForHoliday({
        holidayDate,
        adminId: admin.id,
        tx,
      });
    });

    revalidatePath("/holidays");
    revalidatePath("/schedule");
    revalidatePath("/groups", "layout");
    revalidatePath("/exams");
    revalidatePath("/payments");
    revalidatePath("/refunds");

    return { success: true, ...result };
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "A holiday on this date already exists" };
    }
    throw e;
  }
}
