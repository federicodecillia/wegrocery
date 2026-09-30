import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { createAuth, type Auth, type AuthEmail, type CreateAuthOptions } from "./config";

// Better Auth with the app's configuration on a real database: who gets which
// email, the link's single use and expiry, the session gate, the rate limit.
const BASE = "http://localhost:3000";

function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
}

describeDb("sign-in with an email link", () => {
  const scope = makeScope("auth");
  const { sql } = scope;
  const memberEmail = `${scope.prefix}@example.invalid`;
  const aliasEmail = `${scope.prefix}.alias@example.invalid`;
  const strangerEmail = `${scope.prefix}.stranger@example.invalid`;
  let outbox: AuthEmail[];
  let auth: Auth;
  let ipCounter = 10;
  const nextIp = () => `198.51.100.${ipCounter++}`;

  function post(path: string, body: unknown, ip = nextIp()): Promise<Response> {
    return auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, "x-vercel-forwarded-for": ip },
        body: JSON.stringify(body),
      }),
    );
  }

  async function requestLink(email: string): Promise<AuthEmail> {
    const before = outbox.length;
    const res = await post("/sign-in/magic-link", { email, callbackURL: "/ordine" });
    expect(res.status).toBe(200);
    expect(outbox.length).toBe(before + 1);
    return outbox.at(-1)!;
  }

  async function verify(link: string): Promise<Response> {
    const token = new URL(link).searchParams.get("token")!;
    return auth.handler(
      new Request(`${BASE}/api/auth/magic-link/verify?token=${token}&callbackURL=/ordine&errorCallbackURL=/login`, {
        headers: { "x-vercel-forwarded-for": nextIp() },
      }),
    );
  }

  async function sessionEmail(cookie: string): Promise<string | null> {
    const s = await auth.api.getSession({ headers: new Headers({ cookie }) });
    return s?.user.email ?? null;
  }

  beforeAll(async () => {
    await scope.createMember();
    await sql`UPDATE members SET email = ${memberEmail}, alias_email = ${aliasEmail} WHERE member_id = ${scope.memberId}`;
  });

  function build(extra: Partial<CreateAuthOptions> = {}): Auth {
    return createAuth(getDb(), {
      baseURL: BASE,
      rateLimit: true,
      env: { ...process.env, AUTH_SECRET: "test-secret-at-least-32-characters-long!!", NODE_ENV: "test" },
      // High caps here; the cap test below sets its own.
      emailCaps: { linksPerAddressPerHour: 100, noticesPerAddressPerDay: 100, noticesPerDay: 1000 },
      sendAuthEmail: async (m) => {
        outbox.push(m);
      },
      ...extra,
    });
  }

  beforeEach(() => {
    outbox = [];
    auth = build();
  });

  afterAll(async () => {
    await sql`DELETE FROM auth_users WHERE lower(email) LIKE ${`${scope.prefix}%`}`;
    await sql`DELETE FROM auth_verifications WHERE value LIKE ${`%${scope.prefix}%`}`;
    await sql`DELETE FROM auth_rate_limits WHERE key LIKE '%198.51.100.%' OR key LIKE 'auth-email:%'`;
    await scope.cleanup();
  });

  it("sends a member a link to the confirmation page, and a stranger an explanation, with the same answer", async () => {
    const member = await requestLink(memberEmail);
    expect(member.kind).toBe("login");
    const link = new URL(member.url!);
    expect(link.pathname).toBe("/login/conferma");
    expect(link.searchParams.get("next")).toBe("/ordine");
    expect(link.searchParams.get("token")).toBeTruthy();

    const stranger = await requestLink(strangerEmail);
    expect(stranger).toEqual({ kind: "notMember", email: strangerEmail, url: null });
  });

  it("signs the member in once per link, and records the time", async () => {
    const { url } = await requestLink(memberEmail);
    const first = await verify(url!);
    const cookie = cookieOf(first);
    expect(await sessionEmail(cookie)).toBe(memberEmail);
    const [m] = await sql`SELECT last_login_at FROM members WHERE member_id = ${scope.memberId}`;
    expect(m.last_login_at).not.toBeNull();

    const again = await verify(url!);
    expect(cookieOf(again)).not.toContain("session_token=");
  });

  it("lets a member in with their alias address", async () => {
    const { kind, url } = await requestLink(aliasEmail);
    expect(kind).toBe("login");
    expect(await sessionEmail(cookieOf(await verify(url!)))).toBe(aliasEmail);
  });

  it("refuses an expired link", async () => {
    const { url } = await requestLink(memberEmail);
    await sql`UPDATE auth_verifications SET expires_at = now() - interval '1 minute'
      WHERE value LIKE ${`%${memberEmail}%`}`;
    expect(cookieOf(await verify(url!))).not.toContain("session_token=");
  });

  it("creates no session for a member deactivated after the link went out", async () => {
    const { url } = await requestLink(memberEmail);
    await sql`UPDATE members SET active = false WHERE member_id = ${scope.memberId}`;
    try {
      expect(cookieOf(await verify(url!))).not.toContain("session_token=");
      expect((await requestLink(memberEmail)).kind).toBe("accountInactive");
    } finally {
      await sql`UPDATE members SET active = true WHERE member_id = ${scope.memberId}`;
    }
  });

  it("allows three link requests a minute from one address", async () => {
    const ip = nextIp();
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await post("/sign-in/magic-link", { email: strangerEmail }, ip)).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("sends an invitation when an admin asks for it", async () => {
    await auth.api.signInMagicLink({
      body: { email: memberEmail, callbackURL: "/", metadata: { invite: true } },
      headers: new Headers({ "x-vercel-forwarded-for": nextIp() }),
    });
    expect(outbox.at(-1)).toMatchObject({ kind: "invite", email: memberEmail });
    expect(outbox.at(-1)!.url).toContain("/login/conferma");
  });

  it("decides and sends after the response, so a member's request takes as long as a stranger's", async () => {
    const tasks: (() => Promise<void>)[] = [];
    auth = build({ defer: (task) => void tasks.push(task) });
    const res = await post("/sign-in/magic-link", { email: memberEmail });
    expect(res.status).toBe(200);
    expect(outbox).toEqual([]);
    expect(tasks.length).toBe(1);
    await tasks[0]();
    expect(outbox.at(-1)?.kind).toBe("login");
  });

  it("caps the emails one address can receive", async () => {
    const capped = `${scope.prefix}.capped@example.invalid`;
    auth = build({ emailCaps: { linksPerAddressPerHour: 2, noticesPerAddressPerDay: 1, noticesPerDay: 1000 } });
    for (let i = 0; i < 3; i++) await post("/sign-in/magic-link", { email: capped });
    expect(outbox.filter((m) => m.email === capped).length).toBe(1); // one notice a day
    await sql`UPDATE members SET alias_email = ${capped} WHERE member_id = ${scope.memberId}`;
    try {
      for (let i = 0; i < 3; i++) await post("/sign-in/magic-link", { email: capped });
      expect(outbox.filter((m) => m.email === capped && m.kind === "login").length).toBe(2); // two links an hour
    } finally {
      await sql`UPDATE members SET alias_email = ${aliasEmail} WHERE member_id = ${scope.memberId}`;
    }
  });
});
