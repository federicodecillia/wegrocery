import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { reverseEntry } from "./ledger-reversal";

// The ledger is append-only (drizzle/0023): the trigger refuses edits and
// deletes, and corrections go through reverseEntry.
describeDb("append-only ledger", () => {
  const scope = makeScope("ledger");
  const { sql } = scope;

  async function insert(name: string, type: string, amount: number, cycleId: string | null = null) {
    const entryId = scope.id(name);
    await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at)
      VALUES (${entryId}, ${scope.memberId}, now(), ${type}, ${amount}, ${cycleId}, 'orig', 'int-test', now())`;
    return entryId;
  }
  async function row(entryId: string) {
    const [r] = await sql`SELECT type, amount::text AS amount, reversed_by, reverses, replaces, note FROM ledger_entries WHERE entry_id = ${entryId}`;
    return r;
  }
  const balance = async () =>
    (await sql`SELECT coalesce(sum(amount), 0)::text AS b FROM ledger_entries WHERE member_id = ${scope.memberId}`)[0].b;

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("refuses to change or delete a movement", async () => {
    const id = await insert("t1", "topup", 20);
    await expect(sql`UPDATE ledger_entries SET amount = 25 WHERE entry_id = ${id}`).rejects.toThrow(/append-only/);
    await expect(sql`UPDATE ledger_entries SET note = 'x' WHERE entry_id = ${id}`).rejects.toThrow(/append-only/);
    await expect(sql`DELETE FROM ledger_entries WHERE entry_id = ${id}`).rejects.toThrow(/append-only/);
  });

  it("reverses a movement once, leaving the balance as if it never happened", async () => {
    const id = await insert("t2", "topup", 30);
    const before = await balance();
    const first = await reverseEntry(getDb(), { entryId: id, note: "Annullato", by: "admin@example.invalid" });
    expect(first).not.toBeNull();
    expect(await row(id)).toMatchObject({ reversed_by: first!.reversalId });
    expect(await row(first!.reversalId)).toMatchObject({ type: "reversal", amount: "-30.00", reverses: id });
    expect(Number(await balance())).toBeCloseTo(Number(before) - 30, 2);

    expect(await reverseEntry(getDb(), { entryId: id, note: "again", by: "x" })).toBeNull();
    await expect(sql`UPDATE ledger_entries SET reversed_by = 'other' WHERE entry_id = ${id}`).rejects.toThrow(/append-only/);
  });

  it("corrects a movement with a replacement that points at it", async () => {
    const id = await insert("t3", "payout", -15);
    const result = await reverseEntry(getDb(), {
      entryId: id,
      note: "Corretto",
      by: "admin@example.invalid",
      replacement: { amount: "-12.50", note: "Restituzione corretta" },
    });
    expect(result?.replacementId).toBeTruthy();
    expect(await row(result!.replacementId!)).toMatchObject({ type: "payout", amount: "-12.50", replaces: id, note: "Restituzione corretta" });
    const movements = await sql`SELECT sum(amount)::text AS s FROM ledger_entries WHERE entry_id IN (${id}, ${result!.reversalId}, ${result!.replacementId!})`;
    expect(movements[0].s).toBe("-12.50");
  });

  it("lets a reversed shipping share be posted again on the same cycle", async () => {
    const { cycleId } = await scope.createCycle("ship");
    const id = await insert("s1", "shipping_charge", -3, cycleId);
    const result = await reverseEntry(getDb(), {
      entryId: id,
      note: "Spedizione rettificata",
      by: "admin@example.invalid",
      replacement: { amount: "-2.00", note: "Spedizione rettificata" },
    });
    expect(await row(result!.replacementId!)).toMatchObject({ type: "shipping_charge", amount: "-2.00" });
    // And a second live share for the same member and cycle is still refused.
    await expect(insert("s2", "shipping_charge", -1, cycleId)).rejects.toThrow(/charge_live_uniq/);
  });
});
