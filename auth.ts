import { headers } from "next/headers";
import { after } from "next/server";
import { findMemberByLoginEmail } from "@/lib/auth/admission";
import { sessionClaims } from "@/lib/auth/access";
import { createAuth, MAGIC_LINK_MINUTES, type AuthEmail } from "@/lib/auth/config";
import type { AppSession } from "@/lib/auth/session";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { sendMail } from "@/lib/email/resend";
import { t } from "@/lib/i18n";
import { reportError } from "@/lib/observability";

function authEmailText({ kind, email, url }: AuthEmail): string {
  const e = t.authEmail;
  switch (kind) {
    case "login":
      return e.login(brand.appName, url!, MAGIC_LINK_MINUTES);
    case "invite":
      return e.invite(brand.appName, url!, MAGIC_LINK_MINUTES);
    case "notMember":
      return e.notMember(brand.appName, email, brand.supportEmail);
    case "accountInactive":
      return e.accountInactive(brand.appName, brand.supportEmail);
    case "membershipInactive":
      return e.membershipInactive(brand.appName, brand.membershipUrl ?? null, brand.supportEmail);
    case "checkUnavailable":
      return e.checkUnavailable(brand.appName);
  }
}

// The app's one Better Auth instance (lib/auth/config.ts has the rules).
export const betterAuthInstance = createAuth(getDb(), {
  async sendAuthEmail(message) {
    // After the response: waiting for Resend here would make a member's
    // request measurably slower than a stranger's.
    after(async () => {
      const result = await sendMail({
        to: message.email,
        subject: t.authEmail.subject(message.kind, brand.appName),
        text: authEmailText(message),
      });
      if ("error" in result) reportError("auth email", new Error(result.error), { kind: message.kind });
    });
  },
});

// The signed-in member, in the shape the pages and guards used with Auth.js:
// role, active, memberId and fullName are read from the members table on every
// request, so a deactivated or deleted member is signed out at once.
export async function auth(): Promise<AppSession | null> {
  const session = await betterAuthInstance.api.getSession({ headers: await headers() });
  if (!session) return null;
  const member = await findMemberByLoginEmail(session.user.email);
  const claims = sessionClaims(member);
  if (!claims) return null;
  return { user: { email: session.user.email, ...claims } };
}

// Server Action: ends this browser's session.
export async function signOut(): Promise<void> {
  await betterAuthInstance.api.signOut({ headers: await headers() });
}
