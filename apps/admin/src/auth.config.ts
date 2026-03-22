import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config. No DB imports — used by middleware.
 * DB-dependent callbacks (signIn, jwt, session) are in auth.ts.
 */
export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === "/login";

      if (isOnLogin) return true; // Always allow login page
      if (!isLoggedIn) return false; // Redirect to login
      return true;
    },
  },
} satisfies NextAuthConfig;
