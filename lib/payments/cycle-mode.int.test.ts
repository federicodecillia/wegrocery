import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { getMemberPendingOrderTotals } from "@/lib/db/queries";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { getWalletBalance } from "./balance-due";

// A wallet group running one cycle paid by card next to a wallet cycle: the
// card money stays out of the wallet until the cycle is settled.
describeDb("a card cycle in a wallet group", () => {
  const scope = makeScope("cyclemode");
  const { sql } = scope;
  let walletCycle: string, walletProduct: string, cardCycle: string, cardProduct: string;
  let lines = 0;

  async function order(cycleId: string, productId: string, quantity: number, unitPrice: number) {
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot,
        line_total, updated_at)
      VALUES (${scope.id(`line${++lines}`)}, ${cycleId}, ${scope.memberId}, ${productId}, ${quantity}, ${unitPrice},
        ${(quantity * unitPrice).toFixed(2)}, now())`;
  }

  beforeAll(async () => {
    await scope.createMember();
    ({ cycleId: walletCycle, productIds: [walletProduct] } = await scope.createCycle("w", {
      products: [{ name: "Mele", unitPrice: 5 }],
    }));
    ({ cycleId: cardCycle, productIds: [cardProduct] } = await scope.createCycle("c", {
      paymentMode: "per_order",
      products: [{ name: "Pere", unitPrice: 10 }],
    }));
    // 30 € topped up in the wallet, 22 € paid by card for a 20 € order.
    await scope.addLedger("topup", scope.memberId, "topup", 30, null);
    await scope.createPaidOrderPayment("card", cardCycle, 2200);
    await order(cardCycle, cardProduct, 2, 10);
    await order(walletCycle, walletProduct, 2, 5);
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("leaves the card payment out of the wallet balance while the cycle runs", async () => {
    expect(await getWalletBalance(getDb(), scope.memberId, false)).toBe(30);
  });

  it("leaves the card cycle's order out of the credit limit's pending orders", async () => {
    const pending = await getMemberPendingOrderTotals(scope.memberId, walletCycle);
    expect(pending).toEqual({ otherOpenCycles: 0, thisCycle: 10 });
  });

  it("keeps the card money out after the close, while the card is still owed a refund", async () => {
    await scope.addLedger("card_oc", scope.memberId, "order_charge", -21.5, cardCycle);
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cardCycle}`;
    expect(await getWalletBalance(getDb(), scope.memberId, false)).toBe(30);
    // Settled, but 0.50 € could still go back to the card: still out.
    await sql`UPDATE order_cycles SET settled_at = now() WHERE cycle_id = ${cardCycle}`;
    expect(await getWalletBalance(getDb(), scope.memberId, false)).toBe(30);
  });

  it("brings what is left into the wallet once settled: an amount due becomes a negative movement", async () => {
    // A correction after delivery: costs now beat the payment by 1 €.
    await scope.addLedger("card_fix", scope.memberId, "correction", -1.5, cardCycle);
    expect(await getWalletBalance(getDb(), scope.memberId, false)).toBe(29);
  });

  it("counts every movement for a member who pays outside the app", async () => {
    expect(await getWalletBalance(getDb(), scope.memberId, true)).toBe(29);
  });
});
