import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admitEmail } from "@/lib/auth/admission";
import { getDb } from "@/lib/db/client";
import { approveMembershipRequest, rejectMembershipRequest, storeMembershipRequest } from "@/lib/membership/requests";
import { describeDb, makeScope, runSql } from "./fixtures";

// Open sign-up (drizzle/0052_signup.sql, lib/membership/requests.ts) on a
// real database: one pending request per address, an approval that creates
// the member once however many clicks, and the sign-in decisions per mode.
describeDb("open sign-up (migration 0052)", () => {
  const scope = makeScope("signup");
  const { sql, prefix } = scope;
  const address = (name: string) => `${prefix}_${name}@example.invalid`;
  const statements = (file: string) =>
    readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  let hadSettingsRow = false;
  let savedMode = "closed";

  async function setMode(mode: "closed" | "request" | "open") {
    await sql`UPDATE app_settings SET signup_mode = ${mode} WHERE id = 1`;
  }

  beforeAll(async () => {
    await scope.createMember();
    const [row] = await sql`SELECT signup_mode FROM app_settings WHERE id = 1`;
    hadSettingsRow = Boolean(row);
    if (row) savedMode = row.signup_mode as string;
    else {
      await sql`INSERT INTO app_settings (id, bank_transfer_enabled, online_payments_enabled, updated_at, updated_by)
        VALUES (1, false, true, now(), 'int-test')`;
    }
  });

  afterAll(async () => {
    if (hadSettingsRow) await sql`UPDATE app_settings SET signup_mode = ${savedMode} WHERE id = 1`;
    else await sql`DELETE FROM app_settings WHERE id = 1`;
    const like = `${prefix}%`;
    await sql`DELETE FROM membership_requests WHERE email LIKE ${like}`;
    await sql`DELETE FROM audit_log WHERE entity_id IN (SELECT member_id FROM members WHERE email LIKE ${like} AND member_id <> ${scope.memberId})`;
    await sql`DELETE FROM members WHERE email LIKE ${like} AND member_id <> ${scope.memberId}`;
    await scope.cleanup();
  });

  it("applies again without errors, closed and prepaid by default", async () => {
    for (const statement of statements("drizzle/0052_signup.sql")) await runSql(statement);
    const [m] = await sql`SELECT joined_via FROM members WHERE member_id = ${scope.memberId}`;
    expect(m.joined_via).toBeNull();
    const [d] = await sql`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'app_settings' AND column_name = 'signup_prepaid'`;
    expect(d.column_default).toBe("true");
  });

  it("refuses an admin role for newcomers", async () => {
    await expect(sql`UPDATE app_settings SET signup_role = 'admin' WHERE id = 1`).rejects.toThrow();
  });

  it("keeps one pending request per address, ignoring case, and none for a member", async () => {
    const db = getDb();
    const input = { fullName: "Anna", email: address("anna"), phone: null, note: null, ipHash: `${prefix}_ip1`, termsVersion: null };
    expect((await storeMembershipRequest(db, input)).outcome).toBe("stored");
    expect((await storeMembershipRequest(db, { ...input, email: input.email.toUpperCase() })).outcome).toBe("duplicate");
    const member = await storeMembershipRequest(db, { ...input, email: `${prefix}@example.invalid`, ipHash: `${prefix}_ip2` });
    expect(member.outcome).toBe("member");
    const [n] = await sql`SELECT count(*)::int AS n FROM membership_requests WHERE lower(email) = ${input.email}`;
    expect(n.n).toBe(1);
  });

  it("limits requests from one address to three an hour", async () => {
    const db = getDb();
    const ipHash = `${prefix}_ip3`;
    const outcomes: string[] = [];
    for (const name of ["b1", "b2", "b3", "b4"]) {
      outcomes.push(
        (await storeMembershipRequest(db, { fullName: name, email: address(name), phone: null, note: null, ipHash, termsVersion: null })).outcome,
      );
    }
    expect(outcomes).toEqual(["stored", "stored", "stored", "rate_limited"]);
  });

  it("creates the member once when two admins approve at the same time", async () => {
    const db = getDb();
    const stored = await storeMembershipRequest(db, {
      fullName: "Carla Bianchi",
      email: address("carla"),
      phone: "+39 333",
      note: null,
      ipHash: `${prefix}_ip4`,
      termsVersion: "2026-11-07T12:00:00.000Z",
    });
    const requestId = stored.requestId!;
    const results = await Promise.all([
      approveMembershipRequest(db, { requestId, adminEmail: "a@example.invalid", role: "attivi" }),
      approveMembershipRequest(db, { requestId, adminEmail: "b@example.invalid", role: "attivi" }),
    ]);
    expect(results.filter((r) => r.kind === "approved")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "gone")).toHaveLength(1);
    const rows = await sql`
      SELECT role, joined_via, terms_accepted_version, terms_accepted_at FROM members WHERE email = ${address("carla")}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("attivi");
    expect(rows[0].joined_via).toBe("request");
    expect(rows[0].terms_accepted_version).toBe("2026-11-07T12:00:00.000Z");
    expect(rows[0].terms_accepted_at).not.toBeNull();
    expect(await rejectMembershipRequest(db, { requestId, adminEmail: "a@example.invalid" })).toBe(false);
  });

  it("links a request to the member the address already belongs to", async () => {
    const db = getDb();
    const email = address("dario");
    const stored = await storeMembershipRequest(db, { fullName: "Dario", email, phone: null, note: null, ipHash: `${prefix}_ip5`, termsVersion: null });
    await sql`INSERT INTO members (member_id, full_name, email, role, active, created_at, updated_at)
      VALUES (${`${prefix}_dario`}, 'Dario', ${email}, 'utenti', true, now(), now())`;
    const outcome = await approveMembershipRequest(db, { requestId: stored.requestId!, adminEmail: "a@example.invalid", role: "utenti" });
    expect(outcome).toMatchObject({ kind: "approved", memberId: `${prefix}_dario`, created: false });
    const [n] = await sql`SELECT count(*)::int AS n FROM members WHERE lower(email) = ${email}`;
    expect(n.n).toBe(1);
  });

  it("rejects once", async () => {
    const db = getDb();
    const stored = await storeMembershipRequest(db, { fullName: "Elsa", email: address("elsa"), phone: null, note: null, ipHash: `${prefix}_ip6`, termsVersion: null });
    expect(await rejectMembershipRequest(db, { requestId: stored.requestId!, adminEmail: "a@example.invalid" })).toBe(true);
    expect(await rejectMembershipRequest(db, { requestId: stored.requestId!, adminEmail: "a@example.invalid" })).toBe(false);
  });

  describe("sign-in decisions", () => {
    it("closed: a stranger is not a member", async () => {
      await setMode("closed");
      expect(await admitEmail(address("stranger"), { emailVerified: true })).toEqual({ kind: "deny", error: "NotMember" });
    });

    it("request: a stranger is pointed to the form", async () => {
      await setMode("request");
      expect(await admitEmail(address("stranger"), { emailVerified: true })).toEqual({ kind: "deny", error: "SignupRequired" });
    });

    it("open: a stranger with a confirmed address joins, an unconfirmed one never", async () => {
      await setMode("open");
      expect(await admitEmail(address("stranger"), { emailVerified: true })).toEqual({ kind: "provision", via: "open" });
      expect((await admitEmail(address("stranger"), { emailVerified: false })).kind).toBe("deny");
    });

    it("open: a deactivated member stays out", async () => {
      await setMode("open");
      await sql`INSERT INTO members (member_id, full_name, email, role, active, created_at, updated_at)
        VALUES (${`${prefix}_off`}, 'Off', ${address("off")}, 'utenti', false, now(), now())`;
      expect(await admitEmail(address("off"), { emailVerified: true })).toEqual({ kind: "deny", error: "AccessDenied" });
    });
  });

  it("has a rollback that drops the table and the columns", async () => {
    await sql`DELETE FROM membership_requests WHERE email LIKE ${`${prefix}%`}`;
    for (const statement of statements("drizzle/0052_signup_down.sql")) await runSql(statement);
    const [t] = await sql`SELECT to_regclass('public.membership_requests') IS NULL AS gone`;
    expect(t.gone).toBe(true);
    for (const statement of statements("drizzle/0052_signup.sql")) await runSql(statement);
    const [back] = await sql`SELECT to_regclass('public.membership_requests') IS NOT NULL AS ok`;
    expect(back.ok).toBe(true);
  });
});
