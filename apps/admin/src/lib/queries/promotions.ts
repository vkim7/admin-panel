import { prisma } from "@/server/db";

export async function getPromotions() {
  return prisma.promotion.findMany({
    include: {
      _count: { select: { studentPromotions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type PromotionRow = Awaited<ReturnType<typeof getPromotions>>[number];

export async function getPromotionById(id: string) {
  return prisma.promotion.findUnique({
    where: { id },
  });
}

export async function getActivePromotions() {
  return prisma.promotion.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export type ActivePromotion = Awaited<ReturnType<typeof getActivePromotions>>[number];

export async function getStudentPromotions(studentId: string) {
  return prisma.studentPromotion.findMany({
    where: { studentId },
    include: {
      promotion: { select: { name: true, type: true, discountType: true, discountPercent: true, discountAmount: true } },
      _count: { select: { appliedPromotions: true } },
    },
    orderBy: { appliedAt: "desc" },
  });
}

export type StudentPromotionRow = Awaited<ReturnType<typeof getStudentPromotions>>[number];
