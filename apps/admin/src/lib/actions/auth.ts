"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import {
  createSession,
  destroySession,
  validateTelegramAuth,
  type TelegramAuthData,
} from "@/lib/auth";

export async function loginWithTelegram(data: TelegramAuthData) {
  const isValid = await validateTelegramAuth(data);
  if (!isValid) {
    return { error: "Invalid Telegram authentication data" };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { telegramId: BigInt(data.id) },
    select: { id: true, role: true, isActive: true },
  });

  if (!admin) {
    return { error: "You are not registered as an admin" };
  }

  if (!admin.isActive) {
    return { error: "Your admin account has been deactivated" };
  }

  await createSession(admin.id, admin.role);
  redirect("/schedule");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
