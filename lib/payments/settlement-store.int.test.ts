import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import type { RefundApi } from "./refund-request";
import { previewSettlement, settleCycle } from "./settlement-store";

// "Chiudi i conti" on a real database: refunds of what was paid in excess,
// amounts due, write-offs under Stripe's minimum, members paying outside the
// app left to Treasury, and a second run that changes nothing.
describeDb("settlement of a pay-per-order cycle", () => {
  const scope = makeScope("settle");
  const { sql } = scope;
  let cycleId: string;
  let excess: string, short: string, tiny: string, offline: string;

  const stripe = (): RefundApi =>
    ({
      refunds: {
        create: vi.fn(async (params: { payment_intent: string; amount: number; metadata: { refundId: string } }) => ({
          id: `re_${params.metadata.refundId}`,
          object: "refund",
          payment_intent: params.payment_intent,
          amount: params.amount,
          currency: "eur",
          status: "succeeded",
          created: Math.floor(Date.now() / 1000),
          metadata: params.metadata,
        })),
        list: vi.fn(async () => ({ data: [] })),
      },
    }) as unknown as RefundApi;

  const byMember = async () =>
    Object.fromEntries((await previewSettlement(getDb(), cycleId)).members.map((m) => [m.memberId, m.plan]));

  beforeAll(async () => {
    await scope.createMember();
    excess = scope.memberId;
    short = await scope.createExtraMember("short");
    tiny = await scope.createExtraMember("tiny");
    offline = await scope.createExtraMember("offline", { paysOffline: true });
    ({ cycleId } = await scope.createCycle("c", { paymentMode: "per_order" }));
    // Paid 25.00, cost 19.50: 5.50 back.
    await scope.createPaidOrderPayment("e", cycleId, 2500, excess);
    await scope.addLedger("e_oc", excess, "order_charge", -18, cycleId);
    await scope.addLedger("e_sc", excess, "shipping_charge", -1.5, cycleId);
    // Paid 10.00, cost 12.30: 2.30 due.
    await scope.createPaidOrderPayment("s", cycleId, 1000, short);
    await scope.addLedger("s_oc", short, "order_charge", -12.3, cycleId);
    // Paid 5.00, cost 5.30: 0.30 written off.
    await scope.createPaidOrderPayment("t", cycleId, 500, tiny);
    await scope.addLedger("t_oc", tiny, "order_charge", -5.3, cycleId);
    // Pays outside the app.
    await scope.addLedger("o_oc", offline, "order_charge", -10, cycleId);
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("previews one action per member", async () => {
    expect(await byMember()).toEqual({
      [excess]: { kind: "refund", refunds: [{ paymentId: `${scope.prefix}_pay_e`, amountCents: 550 }], excessCents: 0 },
      [short]: { kind: "due", dueCents: 230 },
      [tiny]: { kind: "writeOff", cents: 30 },
      [offline]: { kind: "offline" },
    });
  });

  it("refunds, writes off and marks the cycle settled; a second run changes nothing", async () => {
    const api = stripe();
    const first = await settleCycle(getDb(), cycleId, { by: "admin@example.invalid", stripe: api });
    expect(first).toMatchObject({ status: "settled", refundsSent: 1, refundsWaiting: 0, writeOffs: 1, due: 1 });

    const net = async (m: string) =>
      (await sql`SELECT coalesce(sum(amount), 0)::text AS n FROM ledger_entries WHERE member_id = ${m} AND cycle_id = ${cycleId}`)[0].n;
    expect(await net(excess)).toBe("0.00");
    expect(await net(tiny)).toBe("0.00");
    expect(await net(short)).toBe("-2.30");
    const [c] = await sql`SELECT settled_at FROM order_cycles WHERE cycle_id = ${cycleId}`;
    expect(c.settled_at).not.toBeNull();
    const dueNotices = await sql`SELECT count(*)::int AS n FROM notifications WHERE member_id = ${short} AND type = 'settlement_due'`;
    expect(dueNotices[0].n).toBe(1);

    const second = await settleCycle(getDb(), cycleId, { by: "admin@example.invalid", stripe: api });
    expect(second).toMatchObject({ refundsSent: 0, writeOffs: 0 });
    expect(api.refunds.create).toHaveBeenCalledTimes(1);
    expect(await net(excess)).toBe("0.00");
  });

  it("refuses an open cycle", async () => {
    const open = await scope.createCycle("open", { paymentMode: "per_order" });
    await expect(settleCycle(getDb(), open.cycleId, { by: "x", stripe: stripe() })).rejects.toThrow(/not closed/);
  });
});
