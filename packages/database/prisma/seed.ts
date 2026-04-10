import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database (essentials only)...\n");

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

  const existingHolidays = await prisma.holiday.count();
  if (existingHolidays === 0) {
    await Promise.all(
      holidayData.map((h) =>
        prisma.holiday.create({
          data: { date: new Date(h.date), name: h.name },
        }),
      ),
    );
    console.log(`Created ${holidayData.length} holidays`);
  } else {
    console.log(`Holidays already exist (${existingHolidays}), skipping`);
  }

  // ─── Transfer Reasons ───────────────────────────────────────────────────
  const existingTransferReasons = await prisma.transferReason.count();
  if (existingTransferReasons === 0) {
    await Promise.all(
      [
        { name: "Teacher dissatisfaction", sortOrder: 1 },
        { name: "Classmates dissatisfaction", sortOrder: 2 },
        { name: "Level too low", sortOrder: 3 },
        { name: "Level too advanced", sortOrder: 4 },
        { name: "Failed mid exam", sortOrder: 5 },
        { name: "Other", isOther: true, sortOrder: 6 },
      ].map((r) => prisma.transferReason.create({ data: r })),
    );
    console.log("Created 6 transfer reasons");
  } else {
    console.log(
      `Transfer reasons already exist (${existingTransferReasons}), skipping`,
    );
  }

  // ─── Lost Reasons ───────────────────────────────────────────────────────
  const existingLostReasons = await prisma.lostReason.count();
  if (existingLostReasons === 0) {
    await Promise.all(
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
      ].map((r) => prisma.lostReason.create({ data: r })),
    );
    console.log("Created 9 lost reasons");
  } else {
    console.log(
      `Lost reasons already exist (${existingLostReasons}), skipping`,
    );
  }

  // ─── Cancellation Reasons ──────────────────────────────────────────────
  const existingCancellationReasons = await prisma.cancellationReason.count();
  if (existingCancellationReasons === 0) {
    await Promise.all(
      [
        { name: "Teacher absence", sortOrder: 1 },
        { name: "Low attendance", sortOrder: 2 },
        { name: "Student request", sortOrder: 3 },
        { name: "Scheduling conflict", sortOrder: 4 },
        { name: "Administrative", sortOrder: 5 },
        { name: "Other", isOther: true, sortOrder: 6 },
        { name: "Holiday", sortOrder: 7, isActive: false },
      ].map((r) => prisma.cancellationReason.create({ data: r })),
    );
    console.log("Created 7 cancellation reasons");
  } else {
    console.log(
      `Cancellation reasons already exist (${existingCancellationReasons}), skipping`,
    );
  }

  // ─── Uncertain Reasons ─────────────────────────────────────────────────
  const existingUncertainReasons = await prisma.uncertainReason.count();
  if (existingUncertainReasons === 0) {
    await Promise.all(
      [
        { name: "Late to lessons", sortOrder: 1 },
        { name: "Misses classes", sortOrder: 2 },
        { name: "Declining engagement", sortOrder: 3 },
        { name: "Frequent rescheduling", sortOrder: 4 },
        { name: "Doesn't do homework", sortOrder: 5 },
        { name: "Lack of progress", sortOrder: 6 },
        { name: "Complaints about difficulty", sortOrder: 7 },
        { name: "Ignoring tests", sortOrder: 8 },
        { name: "Asking for discounts", sortOrder: 9 },
        { name: "Payment delays", sortOrder: 10 },
        { name: "Questions about refunds", sortOrder: 11 },
        { name: "Ignores messages", sortOrder: 12 },
        { name: "Change of environment", sortOrder: 13 },
        { name: "Group conflict", sortOrder: 14 },
        { name: "Other", isOther: true, sortOrder: 15 },
      ].map((r) => prisma.uncertainReason.create({ data: r })),
    );
    console.log("Created 15 uncertain reasons");
  } else {
    console.log(
      `Uncertain reasons already exist (${existingUncertainReasons}), skipping`,
    );
  }

  // ─── Admin Users ───────────────────────────────────────────────────────
  const existingAdmins = await prisma.adminUser.count();
  if (existingAdmins === 0) {
    const admin = await prisma.adminUser.create({
      data: {
        email: "vladimiir.kim@gmail.com",
        telegramId: 511001n,
        firstName: "Vladimir",
        lastName: "Kim",
        role: "SUPER_ADMIN",
      },
    });

    const admin2 = await prisma.adminUser.create({
      data: {
        email: "labforces@gmail.com",
        telegramId: 990254932n,
        firstName: "Laziz",
        lastName: "Islomkhujaev",
        role: "ADMIN",
      },
    });

    const admin3 = await prisma.adminUser.create({
      data: {
        email: "sadullaev1194@gmail.com",
        firstName: "Anvar",
        lastName: "Sadullaev",
        role: "ADMIN",
      },
    });

    console.log(
      `Created admins: ${admin.firstName} (${admin.role}), ${admin2.firstName} (${admin2.role}), ${admin3.firstName} (${admin3.role})`,
    );
  } else {
    console.log(`Admin users already exist (${existingAdmins}), skipping`);
  }

  // ─── Price Settings ────────────────────────────────────────────────────
  const existingPrices = await prisma.priceSetting.count();
  if (existingPrices === 0) {
    const admin = await prisma.adminUser.findFirst({
      where: { role: "SUPER_ADMIN" },
    });
    if (!admin)
      throw new Error("Super admin must exist to create price settings");

    await prisma.priceSetting.createMany({
      data: [
        {
          levelCategory: "GENERAL",
          groupType: "GROUP",
          pricePerLesson: 100000,
          effectiveFrom: new Date("2025-01-01"),
          changedById: admin.id,
        },
        {
          levelCategory: "GENERAL",
          groupType: "INDIVIDUAL",
          pricePerLesson: 200000,
          effectiveFrom: new Date("2025-01-01"),
          changedById: admin.id,
        },
        {
          levelCategory: "IELTS",
          groupType: "GROUP",
          pricePerLesson: 100000,
          effectiveFrom: new Date("2025-01-01"),
          changedById: admin.id,
        },
        {
          levelCategory: "IELTS",
          groupType: "INDIVIDUAL",
          pricePerLesson: 200000,
          effectiveFrom: new Date("2025-01-01"),
          changedById: admin.id,
        },
      ],
    });
    console.log("Created 4 price settings");
  } else {
    console.log(`Price settings already exist (${existingPrices}), skipping`);
  }

  // ─── System Promotions ─────────────────────────────────────────────────
  const existingPromotions = await prisma.promotion.count();
  if (existingPromotions === 0) {
    await prisma.promotion.createMany({
      data: [
        // Trial discounts
        {
          name: "Trial Group Free Lesson",
          type: "TRIAL",
          discountType: "PERCENTAGE",
          discountPercent: 100,
          groupTypes: ["GROUP"],
          isRecurring: false,
          maxUsesPerStudent: 1,
          isActive: true,
        },
        {
          name: "Trial Individual 50%",
          type: "TRIAL",
          discountType: "PERCENTAGE",
          discountPercent: 50,
          groupTypes: ["INDIVIDUAL"],
          isRecurring: false,
          maxUsesPerStudent: 1,
          isActive: true,
        },
        // Referral
        {
          name: "Referral Reward",
          type: "REFERRAL",
          discountType: "FIXED_AMOUNT",
          discountAmount: 100000,
          isRecurring: false,
          maxUsesPerStudent: 1,
          isActive: true,
        },
        {
          name: "Referral Welcome",
          type: "REFERRAL",
          discountType: "FIXED_AMOUNT",
          discountAmount: 100000,
          isRecurring: false,
          maxUsesPerStudent: 1,
          isActive: true,
        },
        // Family
        {
          name: "Family Discount",
          type: "FAMILY",
          discountType: "FIXED_AMOUNT",
          discountAmount: 100000,
          isRecurring: true,
          isActive: true,
        },
        // Win-Back
        {
          name: "Win-Back Discount",
          type: "WIN_BACK",
          discountType: "FIXED_AMOUNT",
          discountAmount: 100000,
          isRecurring: false,
          maxUsesPerStudent: 1,
          isActive: true,
        },
        // Admin-applied
        {
          name: "Apology Discount",
          type: "APOLOGY",
          discountType: "FIXED_AMOUNT",
          discountAmount: 100000,
          isRecurring: false,
          isActive: true,
        },
        {
          name: "Reward Discount",
          type: "REWARD",
          discountType: "FIXED_AMOUNT",
          discountAmount: 100000,
          isRecurring: false,
          isActive: true,
        },
      ],
    });
    console.log("Created 8 system promotions");
  } else {
    console.log(`Promotions already exist (${existingPromotions}), skipping`);
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
