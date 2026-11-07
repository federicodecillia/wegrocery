import { readFileSync } from "node:fs";
import type Stripe from "stripe";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { readMemberOrderLines, replaceOpenOrder } from "@/lib/admin/open-order-store";
import { getDb } from "@/lib/db/client";
import { INVARIANT_CHECKS } from "@/lib/invariants";
import { applyOrderCredit } from "@/lib/payments/order-credit";
import { confirmOrderWithoutPayment } from "@/lib/payments/order-confirm";
import type { RefundApi } from "@/lib/payments/refund-request";
import { planWebhookAction } from "@/lib/payments/webhook";
import { readCycleSold, readCycleStock, setProductLimits, stockShortages } from "@/lib/products/stock";
import { describeDb, makeScope, runSql } from "./fixtures";

// Limited quantities (drizzle/0054_stock_limits.sql, lib/products/stock.ts) on
// a real database: the guards under the cycle lock, the reservation of an
// open Checkout, the late payment that finds the product gone, the admin's
// floor and the nightly invariant.
describeDb("limited quantities (migration 0054)", () => {
  const scope = makeScope("stock");
  const { sql, prefix } = scope;
  const db = () => getDb();
  const statements = (file: string) =>
    readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  let hadSettingsRow = false;
  let savedSwitch = false;
  let other = "";

  const order = (memberId: string, cycleId: string, productId: string, quantity: number) => ({
    memberId,
    cycleId,
    lines: quantity > 0 ? [{ productId, quantity, unitPrice: "4.00" }] : [],
  });
  async function save(memberId: string, cycleId: string, productId: string, quantity: number) {
    const expected = await readMemberOrderLines(db(), memberId, cycleId);
    return replaceOpenOrder(db(), { ...order(memberId, cycleId, productId, quantity), expected });
  }
  async function setSwitch(on: boolean) {
    await sql`UPDATE app_settings SET stock_limits_enabled = ${on} WHERE id = 1`;
  }

  beforeAll(async () => {
    for (const statement of statements("drizzle/0054_stock_limits.sql")) await runSql(statement);
    await scope.createMember();
    other = await scope.createExtraMember("other");
    const [row] = await sql`SELECT stock_limits_enabled FROM app_settings WHERE id = 1`;
    hadSettingsRow = Boolean(row);
    if (row) savedSwitch = row.stock_limits_enabled as boolean;
    else {
      await sql`INSERT INTO app_settings (id, bank_transfer_enabled, online_payments_enabled, updated_at, updated_by)
        VALUES (1, false, true, now(), 'int-test')`;
    }
    await setSwitch(true);
  });

  afterAll(async () => {
    if (hadSettingsRow) await setSwitch(savedSwitch);
    else await sql`DELETE FROM app_settings WHERE id = 1`;
    await scope.cleanup();
  });

  it("applies again without errors, unlimited by default", async () => {
    for (const statement of statements("drizzle/0054_stock_limits.sql")) await runSql(statement);
    const { productIds } = await scope.createCycle("plain", { products: [{ name: "Bread", unitPrice: 4 }] });
    const [p] = await sql`SELECT max_quantity, max_per_member FROM products WHERE product_id = ${productIds[0]}`;
    expect([p.max_quantity, p.max_per_member]).toEqual([null, null]);
  });

  it("sells the last unit once when two members race for it", async () => {
    const { cycleId, productIds } = await scope.createCycle("race", { products: [{ name: "Strawberries", unitPrice: 4 }] });
    const product = productIds[0];
    await sql`UPDATE products SET max_quantity = 3 WHERE product_id = ${product}`;
    expect(await save(scope.memberId, cycleId, product, 2)).toBe("saved");
    const results = await Promise.all([save(scope.memberId, cycleId, product, 3), save(other, cycleId, product, 1)]);
    expect(results.filter((r) => r === "saved")).toHaveLength(1);
    expect((await readCycleSold(db(), cycleId)).get(product)).toBe(3);
  });

  it("lets a member keep or trim, and frees the units at once", async () => {
    const { cycleId, productIds } = await scope.createCycle("trim", { products: [{ name: "Zucchini", unitPrice: 4 }] });
    const product = productIds[0];
    await sql`UPDATE products SET max_quantity = 2, max_per_member = 2 WHERE product_id = ${product}`;
    expect(await save(scope.memberId, cycleId, product, 2)).toBe("saved");
    expect(await save(other, cycleId, product, 1)).toBe("changed");
    const stock = await readCycleStock(db(), cycleId, other);
    expect(stockShortages([{ productId: product, quantity: 1 }], stock)).toEqual([{ productId: product, requested: 1, allowed: 0 }]);
    // Limits lowered under an existing order: keeping it always passes.
    await sql`UPDATE products SET max_per_member = 1 WHERE product_id = ${product}`;
    expect(await save(scope.memberId, cycleId, product, 2)).toBe("saved");
    expect(await save(scope.memberId, cycleId, product, 1)).toBe("saved");
    expect(await save(other, cycleId, product, 1)).toBe("saved");
    expect(await save(other, cycleId, product, 2)).toBe("changed"); // the cap per member
  });

  it("ignores every limit with the setting off", async () => {
    const { cycleId, productIds } = await scope.createCycle("off", { products: [{ name: "Honey", unitPrice: 4 }] });
    await sql`UPDATE products SET max_quantity = 1 WHERE product_id = ${productIds[0]}`;
    await setSwitch(false);
    try {
      expect(await save(scope.memberId, cycleId, productIds[0], 5)).toBe("saved");
      expect((await readCycleStock(db(), cycleId, scope.memberId)).size).toBe(0);
    } finally {
      await setSwitch(true);
    }
    // Back on over an order beyond the limit: the nightly check reports it.
    const check = INVARIANT_CHECKS.find((c) => c.name === "product_max_quantity")!;
    const { rows } = await db().execute<{ id: string }>(check.query);
    expect(rows.map((r) => r.id)).toContain(productIds[0]);
    await sql`UPDATE products SET max_quantity = NULL WHERE product_id = ${productIds[0]}`;
  });

  it("reserves the units of an open Checkout until it expires", async () => {
    const { cycleId, productIds } = await scope.createCycle("reserve", {
      paymentMode: "per_order",
      products: [{ name: "Eggs", unitPrice: 4 }],
    });
    const product = productIds[0];
    await sql`UPDATE products SET max_quantity = 2 WHERE product_id = ${product}`;
    const pay = await scope.createPendingOrderPayment("reserve", cycleId, 880, [
      { productId: product, quantity: 2, unitPriceCents: 400 },
    ]);
    const confirmOther = () =>
      confirmOrderWithoutPayment(db(), {
        memberId: other,
        cycleId,
        lines: [{ productId: product, quantity: 1, unitPrice: "4.00" }],
        expectedCoveredCents: 0,
      });
    expect(await confirmOther()).toBe("changed");
    expect((await readCycleStock(db(), cycleId, other)).get(product)?.usedByOthers).toBe(2);
    await sql`UPDATE payments SET created_at = now() - interval '40 minutes' WHERE payment_id = ${pay.paymentId}`;
    expect((await readCycleStock(db(), cycleId, other)).get(product)?.usedByOthers).toBe(0);
    expect(await confirmOther()).toBe("confirmed");
  });

  it("refunds a payment that arrives after its reservation, for a product gone meanwhile", async () => {
    const { cycleId, productIds } = await scope.createCycle("late", {
      paymentMode: "per_order",
      products: [{ name: "Cherries", unitPrice: 4 }],
    });
    const product = productIds[0];
    await sql`UPDATE products SET max_quantity = 1 WHERE product_id = ${product}`;
    const pay = await scope.createPendingOrderPayment("late", cycleId, 440, [
      { productId: product, quantity: 1, unitPriceCents: 400 },
    ]);
    await sql`UPDATE payments SET created_at = now() - interval '40 minutes' WHERE payment_id = ${pay.paymentId}`;
    expect(await save(other, cycleId, product, 1)).toBe("saved");
    const event = {
      id: `evt_${pay.sessionId}`,
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: pay.sessionId,
          metadata: { paymentId: pay.paymentId, memberId: scope.memberId, cycleId, kind: "order" },
          payment_status: "paid",
          amount_total: 440,
          currency: "eur",
          payment_intent: pay.paymentIntentId,
        },
      },
    } as unknown as Stripe.Event;
    const action = planWebhookAction(event);
    if (action.kind !== "order_credit") throw new Error(`planned ${action.kind}`);
    const stripe = {
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
      },
    } as unknown as RefundApi;
    await applyOrderCredit(action, stripe);
    const mine = await sql`SELECT 1 FROM orders WHERE member_id = ${scope.memberId} AND cycle_id = ${cycleId}`;
    expect(mine).toHaveLength(0);
    const refunds = await sql`SELECT reason, amount_cents FROM refunds WHERE payment_id = ${pay.paymentId}`;
    expect(refunds.map((r) => `${r.reason} ${r.amount_cents}`)).toEqual(["late_payment 440"]);
  });

  it("never lowers the units below what is sold", async () => {
    const { cycleId, productIds } = await scope.createCycle("floor", { products: [{ name: "Apples", unitPrice: 4 }] });
    const product = productIds[0];
    expect(await save(scope.memberId, cycleId, product, 4)).toBe("saved");
    expect(await setProductLimits(db(), { productId: product, maxQuantity: 3, maxPerMember: null })).toEqual({ ok: false, sold: 4 });
    expect(await setProductLimits(db(), { productId: product, maxQuantity: 4, maxPerMember: 5 })).toEqual({ ok: true });
    const [p] = await sql`SELECT max_quantity, max_per_member FROM products WHERE product_id = ${product}`;
    expect([p.max_quantity, p.max_per_member]).toEqual([4, 5]);
  });

  it("is checked every night", async () => {
    const { cycleId, productIds } = await scope.createCycle("night", { products: [{ name: "Pears", unitPrice: 4 }] });
    const product = productIds[0];
    expect(await save(scope.memberId, cycleId, product, 3)).toBe("saved");
    const check = INVARIANT_CHECKS.find((c) => c.name === "product_max_quantity")!;
    const found = async () => (await db().execute<{ id: string }>(check.query)).rows.map((r) => r.id).filter((id) => id.startsWith(prefix));
    expect(await found()).toEqual([]);
    await sql`UPDATE products SET max_quantity = 2 WHERE product_id = ${product}`;
    expect(await found()).toEqual([product]);
    await sql`UPDATE products SET max_quantity = NULL WHERE product_id = ${product}`;
  });

  it("has a rollback that drops the columns", async () => {
    await sql`UPDATE products SET max_quantity = NULL, max_per_member = NULL WHERE product_id LIKE ${`${prefix}%`}`;
    for (const statement of statements("drizzle/0054_stock_limits_down.sql")) await runSql(statement);
    const [c] = await sql`SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_name = 'products' AND column_name IN ('max_quantity', 'max_per_member')`;
    expect(c.n).toBe(0);
    for (const statement of statements("drizzle/0054_stock_limits.sql")) await runSql(statement);
  });
});
