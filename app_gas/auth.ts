import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const devLoginEmail = process.env.AUTH_DEV_LOGIN_EMAIL?.trim().toLowerCase();
const devLoginEnabled = process.env.NODE_ENV !== "production" && Boolean(devLoginEmail);

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev-login",
            name: "Dev Login",
            credentials: {},
            async authorize() {
              const db = getDb();
              const [member] = await db
                .select({
                  memberId: members.memberId,
                  fullName: members.fullName,
                  email: members.email,
                  active: members.active,
                })
                .from(members)
                .where(or(eq(members.email, devLoginEmail!), eq(members.aliasEmail, devLoginEmail!)))
                .limit(1);

              if (!member?.active) return null;
              return {
                id: member.memberId,
                name: member.fullName,
                email: member.email,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
        const email = user.email?.trim().toLowerCase();
        if (!email) return false;

        const db = getDb();
        const [member] = await db
          .select({
            active: members.active,
          })
          .from(members)
          .where(or(eq(members.email, email), eq(members.aliasEmail, email)))
          .limit(1);

        return Boolean(member?.active);
      } catch {
        return false;
      }
    },
    async jwt({ token }) {
      try {
        const email = token.email?.trim().toLowerCase();
        if (!email) return token;

        const db = getDb();
        const [member] = await db
          .select({
            role: members.role,
            active: members.active,
            memberId: members.memberId,
            fullName: members.fullName,
          })
          .from(members)
          .where(or(eq(members.email, email), eq(members.aliasEmail, email)))
          .limit(1);

        token.role = member?.role ?? null;
        token.active = Boolean(member?.active);
        token.memberId = member?.memberId ?? null;
        token.fullName = member?.fullName ?? null;
        return token;
      } catch {
        token.role = null;
        token.active = false;
        return token;
      }
    },
    async session({ session, token }) {
      if (session.user) {
        const userWithRole = session.user as typeof session.user & {
          role?: string | null;
          active?: boolean;
        };

        userWithRole.role =
          typeof token.role === "string" ? token.role : null;
        userWithRole.active = Boolean(token.active);
        (userWithRole as typeof userWithRole & { memberId?: string | null; fullName?: string | null }).memberId =
          typeof token.memberId === "string" ? token.memberId : null;
        (userWithRole as typeof userWithRole & { memberId?: string | null; fullName?: string | null }).fullName =
          typeof token.fullName === "string" ? token.fullName : null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
