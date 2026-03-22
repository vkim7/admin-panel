import NextAuth from "next-auth";
import { prisma } from "@/server/db";
import authConfig from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;

      const admin = await prisma.adminUser.findUnique({
        where: { email: user.email },
        select: { id: true, isActive: true },
      });

      if (!admin || !admin.isActive) return false;
      return true;
    },
    async jwt({ token }) {
      if (!token.email) return token;

      const admin = await prisma.adminUser.findUnique({
        where: { email: token.email },
        select: { id: true, role: true, isActive: true },
      });

      if (admin && admin.isActive) {
        token.adminId = admin.id;
        token.role = admin.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.adminId) {
        session.adminId = token.adminId as string;
        session.role = token.role as string;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    adminId?: string;
    role?: string;
  }
}
