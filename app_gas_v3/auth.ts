import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
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
          .where(eq(members.email, email))
          .limit(1);

        return Boolean(member?.active);
      } catch {
        return false;
      }
    },
  },
  pages: {
    signIn: "/login",
  },
});
