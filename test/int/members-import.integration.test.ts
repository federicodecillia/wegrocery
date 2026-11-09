import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { planImport } from "@/lib/members/import";
import { insertImportedMembers } from "@/lib/members/import-store";
import { describeDb, makeScope } from "./fixtures";

// Members import (lib/members/import-store.ts) on a real database: the same
// file twice creates nobody the second time, and a member created between
// the preview and the import is skipped, not doubled.
describeDb("members import", () => {
  const scope = makeScope("import");
  const { sql, prefix } = scope;
  const address = (name: string) => `${prefix}_${name}@example.invalid`;
  const existing = async () =>
    getDb().select({ email: members.email, aliasEmail: members.aliasEmail, fullName: members.fullName }).from(members);
  const plan = async (text: string) => {
    const p = planImport(text, await existing());
    if (!p.ok) throw new Error(p.error);
    return p;
  };

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    const like = `${prefix}%`;
    await sql`DELETE FROM audit_log WHERE action = 'import_members' AND user_email = ${`${prefix}_admin@example.invalid`}`;
    await sql`DELETE FROM members WHERE email LIKE ${like} AND member_id <> ${scope.memberId}`;
    await scope.cleanup();
  });

  it("imports the new rows once, however many times the file is imported", async () => {
    const text = `email;nome;cognome;ruolo;paga fuori app\n${address("anna")};Anna;Rossi;attivi;sì\n${address("bruno")};Bruno;Verdi;admin;\n${prefix}@example.invalid;Già;Socio;;`;
    const first = await plan(text);
    expect(first.counts).toMatchObject({ new: 2, existing: 1 });
    const created = await insertImportedMembers(getDb(), first, `${prefix}_admin@example.invalid`);
    expect(created).toHaveLength(2);
    const rows = await sql`SELECT email, full_name, role, pays_offline FROM members WHERE member_id = ANY(${created}) ORDER BY email`;
    expect(rows.map((r) => [r.full_name, r.role, r.pays_offline])).toEqual([
      ["Anna Rossi", "attivi", true],
      ["Bruno Verdi", "utenti", false],
    ]);

    const second = await plan(text);
    expect(second.counts).toMatchObject({ new: 0, existing: 3 });
    expect(await insertImportedMembers(getDb(), second, `${prefix}_admin@example.invalid`)).toEqual([]);
  });

  it("skips a member created between the preview and the import", async () => {
    const stale = await plan(`email,name\n${address("carla")},Carla\n${address("dario")},Dario`);
    await sql`INSERT INTO members (member_id, full_name, email, role, active, created_at, updated_at)
      VALUES (${`${prefix}_carla`}, 'Carla', ${address("carla").toUpperCase()}, 'utenti', true, now(), now())`;
    const created = await insertImportedMembers(getDb(), stale, `${prefix}_admin@example.invalid`);
    expect(created).toHaveLength(1);
    const [n] = await sql`SELECT count(*)::int AS n FROM members WHERE lower(email) = ${address("carla")}`;
    expect(n.n).toBe(1);
  });

  it("keeps counts, never addresses, in the audit", async () => {
    const audits = await sql`SELECT payload_json FROM audit_log WHERE action = 'import_members' AND user_email = ${`${prefix}_admin@example.invalid`}`;
    expect(audits.length).toBeGreaterThan(0);
    for (const a of audits) expect(String(a.payload_json)).not.toContain("@");
  });
});
