import { auth } from "@/auth";
import { prisma } from "@/server/db";

// ─── Session ─────────────────────────────────────────────────────────────────

export async function getSession() {
  const session = await auth();
  if (!session?.adminId) return null;
  return { adminId: session.adminId, role: session.role ?? "ADMIN" };
}

// ─── Auth Helpers ───────────────────────────────────────────────────────────

/** Get the current admin from the session. Returns null if not authenticated or admin is inactive. */
export async function getCurrentAdmin() {
  const session = await getSession();
  if (!session) return null;

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: {
      id: true,
      email: true,
      telegramId: true,
      firstName: true,
      lastName: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  if (!admin || !admin.isActive) return null;
  return admin;
}

/** Require authentication. Redirects to /login if not authenticated. */
export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  // redirect() throws — this line only runs if admin is non-null
  return admin!;
}

/** Require a specific role. Throws if not authorized. */
export async function requireRole(role: "SUPER_ADMIN" | "ADMIN") {
  const admin = await requireAdmin();
  if (role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden: requires SUPER_ADMIN role");
  }
  return admin;
}
