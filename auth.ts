import { headers } from "next/headers";
import { after } from "next/server";
import { findMemberById, findMemberByLoginEmail } from "@/lib/auth/admission";
import { sessionClaims } from "@/lib/auth/access";
import { createAuth, MAGIC_LINK_MINUTES, type AuthEmail } from "@/lib/auth/config";
import type { AppSession } from "@/lib/auth/session";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { sendMail } from "@/lib/email/resend";
import { t } from "@/lib/i18n";
import { familyRole, sessionAccount } from "@/lib/members/family";
import { reportError } from "@/lib/observability";

function authEmailText({ kind, email, url, code }: AuthEmail): string {
  const e = t.authEmail;
  switch (kind) {
    case "login":
      return e.login(brand.appName, url!, code!, MAGIC_LINK_MINUTES);
    case "invite":
      return e.invite(brand.appName, url!, code!, MAGIC_LINK_MINUTES);
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

// The app's one Better Auth instance (lib/auth/config.ts has the rules),
// built on first use: the build imports this module without a database
// (a preview without DATABASE_URL must still build).
let instance: ReturnType<typeof createAuth> | null = null;

export function getAuthInstance(): ReturnType<typeof createAuth> {
  instance ??= buildInstance();
  return instance;
}

const buildInstance = () => createAuth(getDb(), {
  // Who the address belongs to, which email and the send all run after the
  // response: a member's request must not take longer than a stranger's.
  defer: (task) => after(task),
  async sendAuthEmail(message) {
    const result = await sendMail({
      to: message.email,
      subject: t.authEmail.subject(message.kind, brand.appName),
      text: authEmailText(message),
    });
    if ("error" in result) reportError("auth email", new Error(result.error), { kind: message.kind });
  },
});

// The signed-in member, in the shape the pages and guards used with Auth.js:
// role, active, memberId and fullName are read from the members table on every
// request, so a deactivated or deleted member is signed out at once.
export async function auth(): Promise<AppSession | null> {
  // headers() first: it marks the page dynamic before anything touches the
  // database (a statically prerendered page must not open it at build time).
  const requestHeaders = await headers();
  const session = await getAuthInstance().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const person = await findMemberByLoginEmail(session.user.email);
  if (person?.householdOf) {
    // A person in a family works on the account they joined.
    const account = sessionAccount(person, await findMemberById(person.householdOf));
    const role = account ? familyRole(person.role, account.role) : null;
    if (!account || !role) return null;
    return {
      user: {
        email: session.user.email,
        memberId: account.memberId,
        personId: person.memberId,
        role,
        active: true,
        fullName: person.fullName,
      },
    };
  }
  const claims = sessionClaims(person);
  if (!claims) return null;
  return { user: { email: session.user.email, ...claims } };
}

// Server Action: ends this browser's session.
export async function signOut(): Promise<void> {
  const requestHeaders = await headers();
  await getAuthInstance().api.signOut({ headers: requestHeaders });
}
