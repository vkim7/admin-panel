"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { referralSchema } from "@/schemas/promotion";

export async function recordReferral(data: unknown) {
  await requireAdmin();
  const parsed = referralSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  // Validate both students exist
  const [referrer, referred] = await Promise.all([
    prisma.student.findUnique({
      where: { id: parsed.data.referrerStudentId },
      select: { id: true },
    }),
    prisma.student.findUnique({
      where: { id: parsed.data.referredStudentId },
      select: { id: true },
    }),
  ]);

  if (!referrer) return { error: "Referrer student not found" };
  if (!referred) return { error: "Referred student not found" };

  try {
    await prisma.referral.create({
      data: {
        referrerStudentId: parsed.data.referrerStudentId,
        referredStudentId: parsed.data.referredStudentId,
      },
    });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      // Check which unique constraint was violated
      const meta = (e as { meta?: { target?: string[] } }).meta;
      if (meta?.target?.includes("referredStudentId")) {
        return { error: "This student has already been referred by someone" };
      }
      return { error: "This referral already exists" };
    }
    throw e;
  }

  revalidatePath(`/students/${parsed.data.referrerStudentId}`);
  revalidatePath(`/students/${parsed.data.referredStudentId}`);
  return { success: true };
}
