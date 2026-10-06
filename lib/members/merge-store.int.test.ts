import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { INVARIANT_CHECKS } from "@/lib/invariants";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { mergeMembers } from "./merge-store";

// The merge on a real database: what moves, what stays, the ledger pair, the
// guard, and the nightly checks on the result.
describeDb("member merge", () => {
  const scope = makeScope("merge");
  const { sql } = scope;
  const db = () => getDb();

  async function merge(survivorId: string, absorbedId: string, alias?: string | null) {
    return mergeMembers(db(), { survivorId, absorbedId, alias, actingMemberId: null, adminEmail: "int-test@example.invalid" });
  }

  async function member(id: string) {
    const rows = await sql`SELECT member_id, email, alias_email, active, merged_into FROM members WHERE member_id = ${id}`;
    return rows[0] as
      | { member_id: string; email: string; alias_email: string | null; active: boolean; merged_into: string | null }
      | undefined;
  }

  async function balance(id: string): Promise<number> {
    const [r] = await sql`SELECT coalesce(sum(amount), 0)::float AS b FROM ledger_entries WHERE member_id = ${id}`;
    return Number(r.b);
  }

  async function invariantBreaks(): Promise<string[]> {
    const out: string[] = [];
    for (const check of INVARIANT_CHECKS) {
      const { rows } = await db().execute<{ id: string }>(check.query);
      for (const r of rows) if (r.id.includes(scope.prefix)) out.push(`${check.name}:${r.id}`);
    }
    return out;
  }

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("moves open-cycle orders, drafts and notifications, then deletes an account with no history", async () => {
    const survivor = await scope.createExtraMember("a1");
    const absorbed = await scope.createExtraMember("b1");
    const { cycleId, productIds } = await scope.createCycle("open1", { products: [{ name: "Bread", unitPrice: 3 }] });
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
      VALUES (${scope.id("line1")}, ${cycleId}, ${absorbed}, ${productIds[0]}, 2, 3, 6, now())`;
    await sql`INSERT INTO notifications (notification_id, member_id, type, title, body, created_at)
      VALUES (${scope.id("not1")}, ${absorbed}, 'cycle_opened', 'x', 'y', now())`;
    const absorbedEmail = (await member(absorbed))!.email;

    const { decision, result } = await merge(survivor, absorbed);
    expect(decision.ok).toBe(true);
    expect(result).toMatchObject({ deletedAbsorbed: true, transferCents: 0, movedCycles: 1 });

    expect(await member(absorbed)).toBeUndefined();
    expect((await member(survivor))!.alias_email).toBe(absorbedEmail.toLowerCase());
    const [line] = await sql`SELECT member_id FROM orders WHERE order_line_id = ${scope.id("line1")}`;
    expect(line.member_id).toBe(survivor);
    const [n] = await sql`SELECT member_id FROM notifications WHERE notification_id = ${scope.id("not1")}`;
    expect(n.member_id).toBe(survivor);
    expect(await invariantBreaks()).toEqual([]);
  });

  it("keeps an account with history, moves its balance as a pair and frees its address", async () => {
    const survivor = await scope.createExtraMember("a2");
    const absorbed = await scope.createExtraMember("b2");
    const { cycleId, productIds } = await scope.createCycle("closed2", { products: [{ name: "Milk", unitPrice: 2 }] });
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
      VALUES (${scope.id("line2")}, ${cycleId}, ${absorbed}, ${productIds[0]}, 1, 2, 2, now())`;
    await scope.addLedger("topup2", absorbed, "topup", 10, null);
    await scope.addLedger("charge2", absorbed, "order_charge", -2, cycleId);
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
    await scope.addLedger("topup2a", survivor, "topup", 5, null);

    const { decision, result } = await merge(survivor, absorbed);
    expect(decision.ok).toBe(true);
    expect(result).toMatchObject({ deletedAbsorbed: false, transferCents: 800, movedCycles: 0 });

    const kept = (await member(absorbed))!;
    expect(kept).toMatchObject({ active: false, merged_into: survivor, alias_email: null });
    expect(kept.email).toMatch(/@merged\.invalid$/);
    expect(await balance(absorbed)).toBe(0);
    expect(await balance(survivor)).toBe(13);
    // The closed-cycle order stays next to its charge.
    const [line] = await sql`SELECT member_id FROM orders WHERE order_line_id = ${scope.id("line2")}`;
    expect(line.member_id).toBe(absorbed);
    expect(await invariantBreaks()).toEqual([]);

    // Already merged: a second merge is refused.
    const again = await merge(survivor, absorbed);
    expect(!again.decision.ok && again.decision.refusal.code).toBe("already_merged");
  });

  it("refuses when both have an order on the same open cycle, and changes nothing", async () => {
    const survivor = await scope.createExtraMember("a3");
    const absorbed = await scope.createExtraMember("b3");
    const { cycleId, productIds } = await scope.createCycle("open3", { products: [{ name: "Eggs", unitPrice: 4 }] });
    for (const [who, id] of [
      [survivor, "line3a"],
      [absorbed, "line3b"],
    ]) {
      await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
        VALUES (${scope.id(id)}, ${cycleId}, ${who}, ${productIds[0]}, 1, 4, 4, now())`;
    }
    const { decision } = await merge(survivor, absorbed);
    expect(!decision.ok && decision.refusal.code).toBe("both_ordered");
    expect((await member(absorbed))!.active).toBe(true);
  });

  it("finds a broken merge pair and a merged account left with money", async () => {
    const a = await scope.createExtraMember("a4");
    const b = await scope.createExtraMember("b4");
    await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, note, created_by, created_at, counterpart)
      VALUES (${scope.id("mm_out")}, ${b}, now(), 'member_merge', -5, 'int-test', 'int-test', now(), ${scope.id("mm_missing")})`;
    await sql`UPDATE members SET active = false, merged_into = ${a} WHERE member_id = ${b}`;
    const found = await invariantBreaks();
    expect(found).toContain(`member_merge_pairs:${scope.id("mm_out")}`);
    expect(found).toContain(`merged_member_empty:${b}`);
  });

  it("links a person to a family on an accepted invitation: balance and open orders move, the person stays", async () => {
    const account = await scope.createExtraMember("a5");
    const person = await scope.createExtraMember("b5");
    const { cycleId, productIds } = await scope.createCycle("open5", { products: [{ name: "Rice", unitPrice: 5 }] });
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
      VALUES (${scope.id("line5")}, ${cycleId}, ${person}, ${productIds[0]}, 1, 5, 5, now())`;
    await sql`INSERT INTO notifications (notification_id, member_id, type, title, body, created_at)
      VALUES (${scope.id("not5")}, ${person}, 'cycle_opened', 'x', 'y', now())`;
    await scope.addLedger("topup5", person, "topup", 7, null);
    const inviteId = scope.id("inv5");
    await sql`INSERT INTO family_invites (invite_id, account_id, member_id, invited_by, created_at, expires_at)
      VALUES (${inviteId}, ${account}, ${person}, 'int-test@example.invalid', now(), now() + interval '7 days')`;

    const { decision, result } = await mergeMembers(db(), {
      survivorId: account,
      absorbedId: person,
      actingMemberId: person,
      adminEmail: "int-test@example.invalid",
      mode: "link",
      inviteId,
    });
    expect(decision.ok).toBe(true);
    expect(result).toMatchObject({ deletedAbsorbed: false, transferCents: 700, movedCycles: 1 });

    const [p] = await sql`SELECT active, household_of, merged_into FROM members WHERE member_id = ${person}`;
    expect(p).toMatchObject({ active: true, household_of: account, merged_into: null });
    expect(await balance(person)).toBe(0);
    expect(await balance(account)).toBe(7);
    const [line] = await sql`SELECT member_id FROM orders WHERE order_line_id = ${scope.id("line5")}`;
    expect(line.member_id).toBe(account);
    // The person keeps their own notifications.
    const [n] = await sql`SELECT member_id FROM notifications WHERE notification_id = ${scope.id("not5")}`;
    expect(n.member_id).toBe(person);
    const [inv] = await sql`SELECT status FROM family_invites WHERE invite_id = ${inviteId}`;
    expect(inv.status).toBe("accepted");
    expect(await invariantBreaks()).toEqual([]);

    // The invitation is spent: accepting it again rolls back.
    await sql`UPDATE members SET household_of = NULL WHERE member_id = ${person}`;
    await expect(
      mergeMembers(db(), {
        survivorId: account,
        absorbedId: person,
        actingMemberId: person,
        adminEmail: "int-test@example.invalid",
        mode: "link",
        inviteId,
      }),
    ).rejects.toThrow();
    const [after] = await sql`SELECT household_of FROM members WHERE member_id = ${person}`;
    expect(after.household_of).toBeNull();
  });

  it("finds a person in a family left with money", async () => {
    const account = await scope.createExtraMember("a6");
    const person = await scope.createExtraMember("b6");
    await sql`UPDATE members SET household_of = ${account} WHERE member_id = ${person}`;
    await scope.addLedger("topup6", person, "topup", 3, null);
    expect(await invariantBreaks()).toContain(`household_member_empty:${person}`);
    await sql`UPDATE members SET household_of = NULL WHERE member_id = ${person}`;
  });
});
