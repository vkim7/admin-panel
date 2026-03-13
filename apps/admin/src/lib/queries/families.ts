import { prisma } from "@/server/db";

export async function searchFamilies(query: string) {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim();

  return prisma.family.findMany({
    where: {
      OR: [
        { parentPhone: { contains: q } },
        { parentFirstName: { contains: q, mode: "insensitive" } },
        { parentLastName: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        {
          students: {
            some: {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            },
          },
        },
      ],
    },
    include: {
      students: { select: { id: true, firstName: true, lastName: true } },
    },
    take: 10,
  });
}

export async function getFamilyById(id: string) {
  return prisma.family.findUnique({
    where: { id },
    include: {
      students: {
        select: { id: true, firstName: true, lastName: true, crmCode: true, status: true },
      },
    },
  });
}

export async function checkFamilyPhoneExists(phone: string, excludeId?: string) {
  const existing = await prisma.family.findFirst({
    where: {
      parentPhone: phone,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, parentFirstName: true, parentLastName: true },
  });
  return existing;
}
