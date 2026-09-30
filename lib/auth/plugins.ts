import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

// Password-free ways in that do not use email: the public demo's two profiles
// and the developer's own member on a local machine. Both find or create the
// sign-in identity of a member's address; the session hook in
// lib/auth/config.ts still requires that member to be active.

async function signInAs(ctx: GenericEndpointContext, email: string, rememberMe: boolean) {
  const adapter = ctx.context.internalAdapter;
  const found = await adapter.findUserByEmail(email);
  const user = found?.user ?? (await adapter.createUser({ email, name: "", emailVerified: true }, { method: "admin" }));
  const session = await adapter.createSession(user.id, !rememberMe);
  if (!session) throw new APIError("FORBIDDEN");
  await setSessionCookie(ctx, { session, user }, !rememberMe);
  return ctx.json({ ok: true });
}

// POST /demo/sign-in { profile: "user" | "admin" }: the demo's seeded members
// (scripts/seed-demo.ts). Registered only with DEMO_MODE=true.
export const DEMO_LOGIN_EMAILS = { user: "demo.socio@example.com", admin: "demo.admin@example.com" } as const;

export function demoLogin(): BetterAuthPlugin {
  return {
    id: "demo-login",
    endpoints: {
      demoSignIn: createAuthEndpoint("/demo/sign-in", { method: "POST" }, async (ctx) => {
        const profile = (ctx.body as { profile?: unknown } | undefined)?.profile === "admin" ? "admin" : "user";
        return signInAs(ctx, DEMO_LOGIN_EMAILS[profile], false);
      }),
    },
  };
}

// POST /dev/sign-in: AUTH_DEV_LOGIN_EMAIL's member, on a local machine only
// (registered only outside production).
export function devLogin(email: string): BetterAuthPlugin {
  return {
    id: "dev-login",
    endpoints: {
      devSignIn: createAuthEndpoint("/dev/sign-in", { method: "POST" }, async (ctx) => signInAs(ctx, email, true)),
    },
  };
}
