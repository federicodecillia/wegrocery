import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq, or } from "drizzle-orm";
import { sessionClaims } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/member-email";
import { provisionVerifiedMember, recordMembershipCheck } from "@/lib/membership/members";
import { existingMemberSignIn, loginErrorPath, newUserSignIn } from "@/lib/membership/policy";
import {
  checkMembership,
  checkMembershipAny,
  isMembershipCheckEnabled,
  type MembershipResult,
} from "@/lib/membership/wallyfor";

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const devLoginEmail = normalizeEmail(process.env.AUTH_DEV_LOGIN_EMAIL);
const devLoginEnabled = process.env.NODE_ENV !== "production" && Boolean(devLoginEmail);
const demoModeEnabled = process.env.DEMO_MODE === "true";
// Demo profile -> seeded account (scripts/seed-demo.ts). The profile names are
// not role values: "user" signs in as the seeded 'utenti' member.
const DEMO_LOGIN_EMAILS: Record<"user" | "admin", string> = {
  user: "demo.socio@example.com",
  admin: "demo.admin@example.com",
};

// Bookkeeping only: a failed write must not flip the sign-in decision.
async function recordMembershipCheckSafely(memberId: string, status: "valid" | "invalid") {
  try {
    await recordMembershipCheck(memberId, status);
  } catch (err) {
    console.error("[auth] could not record membership check", err);
  }
}

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
    ...(demoModeEnabled
      ? [
          Credentials({
            id: "demo-login",
            name: "Demo Login",
            credentials: { profile: {} },
            async authorize(credentials) {
              const profile = credentials?.profile === "admin" ? "admin" : "user";
              const email = DEMO_LOGIN_EMAILS[profile];
              const db = getDb();
              const [member] = await db
                .select({
                  memberId: members.memberId,
                  fullName: members.fullName,
                  email: members.email,
                  active: members.active,
                })
                .from(members)
                .where(eq(members.email, email))
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
    async signIn({ user, account, profile }) {
      try {
        const email = normalizeEmail(user.email);
        if (!email) return false;

        const db = getDb();
        const [member] = await db
          .select({
            memberId: members.memberId,
            email: members.email,
            aliasEmail: members.aliasEmail,
            role: members.role,
            active: members.active,
          })
          .from(members)
          .where(or(eq(members.email, email), eq(members.aliasEmail, email)))
          .limit(1);

        // The membership-card gate applies to Google sign-ins only; the
        // dev/demo credential providers keep the plain whitelist.
        const checkEnabled = account?.provider === "google" && isMembershipCheckEnabled();
        // Self-onboarding trusts the address only if Google verified it.
        const emailVerified = profile?.email_verified !== false;

        let decision = member
          ? existingMemberSignIn(member, checkEnabled, null)
          : newUserSignIn(checkEnabled, null, emailVerified);
        let result: MembershipResult | null = null;
        if (decision.kind === "check") {
          result = member
            ? await checkMembershipAny([member.email, member.aliasEmail])
            : await checkMembership(email);
          decision = member
            ? existingMemberSignIn(member, checkEnabled, result)
            : newUserSignIn(checkEnabled, result, emailVerified);
        }
        if ("logError" in decision && decision.logError && result?.status === "error") {
          console.error(`[auth] membership check unavailable at sign-in: ${result.message}`);
        }

        switch (decision.kind) {
          case "allow":
            if (member && decision.record) await recordMembershipCheckSafely(member.memberId, decision.record);
            return true;
          case "provision": {
            const provisioned = await provisionVerifiedMember(email, user.name);
            return provisioned.active ? true : loginErrorPath("AccessDenied", email);
          }
          case "deny":
            if (member && decision.record) await recordMembershipCheckSafely(member.memberId, decision.record);
            return loginErrorPath(decision.error, email);
          default:
            return false;
        }
      } catch (err) {
        console.error("[auth] signIn callback failed", err);
        return false;
      }
    },
    async jwt({ token }) {
      try {
        const email = normalizeEmail(token.email);
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

        // Deactivated or deleted since signing in: end the session on this
        // request. Auth.js clears the cookie when the callback returns null,
        // so middleware and every guard see the member as signed out.
        const claims = sessionClaims(member);
        if (!claims) return null;
        return Object.assign(token, claims);
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
