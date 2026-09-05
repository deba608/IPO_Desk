// src/auth.ts
// User authentication: Google OAuth only (Auth.js v5, JWT sessions).
// No passwords exist in this app — neither stored nor accepted.
//
// Design notes:
// - JWT strategy (stateless): no per-request DB reads, serverless-safe, and
//   sign-in works even without DATABASE_URL configured.
// - No PrismaAdapter: user rows are created on demand (see
//   resolveAlertOwner / /api/alerts/link) instead of at sign-in time, so auth
//   never hard-depends on the database.
// - Admin auth is a SEPARATE system (passwordless OTP, `ipodesk_admin`
//   cookie) — a Google login never grants admin powers.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required behind Vercel's proxy for callback URL validation.
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the stable Google subject id on first sign-in.
      if (account?.provider === "google" && profile) {
        token.providerId = (profile as { sub?: string }).sub ?? token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.providerId as string | undefined) ?? token.sub ?? "";
      }
      return session;
    },
  },
});
