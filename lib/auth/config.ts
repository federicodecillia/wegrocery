import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { authAccounts, authRateLimits, authSessions, authUsers, authVerifications, members } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/member-email";
import { reportError } from "@/lib/observability";
import { admitEmail, memberForNewSession } from "./admission";
import { AUTH_COOKIE_PREFIX } from "./cookie";
import { DEFAULT_EMAIL_CAPS, mayEmail, type EmailCaps } from "./email-caps";
import { authEmailKind, carriesLink, type AuthEmailKind } from "./email-kind";
import { oauthIdentityRefusal } from "./identity";
import { allowedHosts, fallbackBaseURL, safeCallbackPath } from "./hosts";
import { demoLogin, devLogin } from "./plugins";

// The one Better Auth configuration (auth.ts builds the instance). Sign-in
// with an email link by default, Google where its variables are set, the
// demo's and the developer's shortcuts where they apply. Who gets in is
// lib/auth/admission.ts, checked before a link goes out, when Google hands
// an identity over, and again when any session is created.

type Env = Record<string, string | undefined>;
type Db = ReturnType<typeof getDb>;

// The "15 minuti" of the email (link and code): change them together.
export const MAGIC_LINK_MINUTES = 15;
const DAY_SECONDS = 24 * 60 * 60;

export type AuthEmail = {
  kind: AuthEmailKind;
  email: string;
  // The confirmation page on this deploy, for the kinds that carry a link.
  url: string | null;
  // The 6-digit code that works like the link (typed on /login), same kinds.
  code: string | null;
};

export type CreateAuthOptions = {
  sendAuthEmail: (message: AuthEmail) => Promise<void>;
  // Tests pin a local URL; the app resolves it per request among the allowed hosts.
  baseURL?: string;
  // Better Auth turns its limiter on only in production; tests switch it on here.
  rateLimit?: boolean;
  env?: Env;
  // Runs the decision and the send of a sign-in email after the response
  // (the app passes next/server's after()), so the answer takes the same time
  // for a member and a stranger. Default: right away (tests).
  defer?: (task: () => Promise<void>) => void | Promise<void>;
  emailCaps?: EmailCaps;
};

export function googleCredentials(env: Env): { clientId: string; clientSecret: string } | null {
  const clientId = env.AUTH_GOOGLE_ID?.trim() ?? "";
  const clientSecret = env.AUTH_GOOGLE_SECRET?.trim() ?? "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

// The link in the email opens a page with a button (app/login/conferma), not
// Better Auth's verify endpoint: mail scanners open links, and a link that
// works once would be spent before the member clicks it.
export function confirmationURL(verifyUrl: string, token: string): string {
  const verify = new URL(verifyUrl);
  const confirm = new URL("/login/conferma", verify.origin);
  confirm.searchParams.set("token", token);
  confirm.searchParams.set("next", safeCallbackPath(verify.searchParams.get("callbackURL")));
  return confirm.toString();
}

export function createAuth(db: Db, options: CreateAuthOptions) {
  const env = options.env ?? process.env;
  const google = googleCredentials(env);
  const devEmail = normalizeEmail(env.AUTH_DEV_LOGIN_EMAIL);

  // The code goes out in the link's email, so it is issued here rather than
  // through the plugin's own send endpoint (closed, see public-endpoints.ts).
  // Only the latest code of an address works: earlier ones are dropped.
  async function issueSignInCode(email: string): Promise<string> {
    await db.delete(authVerifications).where(eq(authVerifications.identifier, `sign-in-otp-${email.toLowerCase()}`));
    return instance.api.createVerificationOTP({ body: { email, type: "sign-in" } });
  }

  const instance = betterAuth({
    secret: env.AUTH_SECRET,
    baseURL: options.baseURL ?? {
      // Never empty (Better Auth refuses that): the fallback's host at least.
      allowedHosts: allowedHosts(env).length > 0 ? allowedHosts(env) : [new URL(fallbackBaseURL(env)).host],
      fallback: fallbackBaseURL(env),
      protocol: env.NODE_ENV === "development" ? "http" : "https",
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { authUsers, authSessions, authAccounts, authVerifications, authRateLimits },
    }),
    user: {
      modelName: "authUsers",
      // Google (every time) and a first email-link or code sign-in: the same gate as
      // the email link itself. A refusal lands on /login?error=<code>.
      validateUserInfo: async ({ user, source }) => {
        if (source.method !== "oauth" && source.method !== "magic-link" && source.method !== "email-otp") return;
        const refusal = oauthIdentityRefusal(user, source);
        if (refusal) return refusal;
        const email = typeof user.email === "string" ? user.email : "";
        const admission = await admitEmail(email, { emailVerified: true });
        if (admission.kind === "deny") return { error: admission.error };
      },
    },
    session: { modelName: "authSessions", expiresIn: 30 * DAY_SECONDS, updateAge: DAY_SECONDS },
    account: {
      modelName: "authAccounts",
      // Google's tokens are never kept nor refreshed: the app never calls
      // Google after the sign-in.
      updateAccountOnSignIn: false,
      // Google links to an existing identity only when Google verified the
      // address (Better Auth's rule without trusted providers).
      accountLinking: { enabled: true },
    },
    verification: { modelName: "authVerifications" },
    socialProviders: google
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            disableIdTokenSignIn: true,
            prompt: "select_account",
            // Name and email only: no profile picture.
            mapProfileToUser: () => ({ image: undefined }),
          },
        }
      : undefined,
    // A code is issued only to an address the admission let in; this rechecks
    // it when the code is typed, so an address refused since gets the same 400
    // as a wrong code instead of a session the hook below refuses (a 500).
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email-otp") return;
        const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
        if ((await admitEmail(email, { emailVerified: true })).kind === "deny") {
          throw new APIError("BAD_REQUEST", { message: "Invalid OTP" });
        }
      }),
    },
    onAPIError: { errorURL: "/login?error=AccessDenied" },
    rateLimit: {
      enabled: options.rateLimit ?? env.NODE_ENV === "production",
      storage: "database",
      modelName: "authRateLimits",
      customRules: {
        "/sign-in/magic-link": { window: 60, max: 3 },
        // On top of the 3 tries a code allows and the codes an address receives (email-caps.ts).
        "/sign-in/email-otp": { window: 60, max: 5 },
        "/demo/sign-in": { window: 60, max: 30 },
      },
    },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      disableOriginCheck: false,
      database: { generateId: () => crypto.randomUUID() },
      // Vercel overwrites this header: a client cannot fake its address.
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] },
    },
    databaseHooks: {
      session: {
        create: {
          // Every way in ends here: a session exists only for an active
          // member (created now for a card holder the check admitted), and it
          // keeps no IP address or browser.
          before: async (session) => {
            const [identity] = await db
              .select({ email: authUsers.email, name: authUsers.name })
              .from(authUsers)
              .where(eq(authUsers.id, session.userId))
              .limit(1);
            if (!identity) return false;
            // The name in a sign-in request is whatever the requester typed: never
            // use it for a new member.
            const memberId = await memberForNewSession(identity.email, null);
            if (!memberId) return false;
            return { data: { ...session, ipAddress: null, userAgent: null } };
          },
          after: async (session) => {
            await db.execute(sql`
              UPDATE ${members} SET last_login_at = now()
              WHERE member_id = (
                SELECT m.member_id FROM ${members} m, ${authUsers} u
                WHERE u.id = ${session.userId}
                  AND (lower(m.email) = lower(u.email) OR lower(m.alias_email) = lower(u.email))
                LIMIT 1
              )`);
          },
        },
      },
      account: {
        create: {
          before: async (account) => ({
            data: { ...account, accessToken: null, refreshToken: null, idToken: null },
          }),
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_MINUTES * 60,
        storeToken: "hashed",
        // Better Auth answers every request the same way; which email goes
        // out (a link, an invitation, or why not) is decided here.
        sendMagicLink: async ({ email, url, token, metadata }) => {
          const task = async () => {
            try {
              const admission = await admitEmail(email, { emailVerified: true });
              const kind = authEmailKind(admission, metadata?.invite === true);
              if (!(await mayEmail(db, email, carriesLink(kind), options.emailCaps ?? DEFAULT_EMAIL_CAPS))) return;
              const withLink = carriesLink(kind);
              await options.sendAuthEmail({
                kind,
                email,
                url: withLink ? confirmationURL(url, token) : null,
                code: withLink ? await issueSignInCode(email) : null,
              });
            } catch (e) {
              reportError("auth email", e);
            }
          };
          await (options.defer ?? ((t) => t()))(task);
        },
      }),
      // The code of the link's email (issueSignInCode). The plugin's own sends
      // are off: its email would carry no admission decision.
      emailOTP({
        otpLength: 6,
        expiresIn: MAGIC_LINK_MINUTES * 60,
        storeOTP: "hashed",
        allowedAttempts: 3,
        sendVerificationOTP: async () => {},
      }),
      ...(env.DEMO_MODE === "true" ? [demoLogin()] : []),
      ...(env.NODE_ENV !== "production" && devEmail ? [devLogin(devEmail)] : []),
      // Last, as Better Auth wants: lets Server Actions set its cookies.
      nextCookies(),
    ],
  });
  return instance;
}

export type Auth = ReturnType<typeof createAuth>;
