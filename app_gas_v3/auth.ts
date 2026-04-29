import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
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
