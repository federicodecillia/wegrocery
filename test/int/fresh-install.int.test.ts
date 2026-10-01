import { readdirSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { admitEmail, memberForNewSession } from "@/lib/auth/admission";
import { testSql as sql } from "./fixtures";

// A new installation on its first day: an empty database that has just
// applied every migration from 0000. CI runs this file alone on such a
// database with INT_TEST_FRESH=1; everywhere else it is skipped, since its
// assertions (no member yet) hold only there.
const describeFresh =
  process.env.INT_TEST_DB_READY === "1" && process.env.INT_TEST_FRESH === "1" ? describe : describe.skip;

describeFresh("a new installation", () => {
  const first = "first.admin@example.invalid";
  const saved = process.env.BOOTSTRAP_ADMIN_EMAIL;
  process.env.BOOTSTRAP_ADMIN_EMAIL = first;

  afterAll(() => {
    if (saved === undefined) delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    else process.env.BOOTSTRAP_ADMIN_EMAIL = saved;
  });

  it("has applied every migration and has no member", async () => {
    const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
    const applied = await sql`SELECT name FROM _migrations ORDER BY name`;
    expect(applied.map((r) => r.name)).toEqual(files);
    expect(await sql`SELECT 1 FROM members`).toHaveLength(0);
  });

  it("refuses a stranger", async () => {
    expect(await admitEmail("stranger@example.invalid", { emailVerified: true })).toEqual({
      kind: "deny",
      error: "NotMember",
    });
  });

  it("makes the BOOTSTRAP_ADMIN_EMAIL address the first admin at its first sign-in", async () => {
    expect(await admitEmail(first, { emailVerified: true })).toEqual({ kind: "bootstrapAdmin" });
    const memberId = await memberForNewSession(first, null);
    expect(memberId).toBeTruthy();
    const [m] = await sql`SELECT email, role, active FROM members WHERE member_id = ${memberId}`;
    expect(m).toEqual({ email: first, role: "admin", active: true });
    const audit = await sql`SELECT action FROM audit_log WHERE entity_id = ${memberId}`;
    expect(audit.map((r) => r.action)).toEqual(["bootstrap_admin"]);
    expect(await admitEmail(first, { emailVerified: true })).toEqual({ kind: "member", memberId });
  });

  it("ignores the variable once an admin exists", async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = "second@example.invalid";
    expect(await admitEmail("second@example.invalid", { emailVerified: true })).toEqual({
      kind: "deny",
      error: "NotMember",
    });
    expect(await memberForNewSession("second@example.invalid", null)).toBeNull();
    expect(await sql`SELECT 1 FROM members`).toHaveLength(1);
  });
});
