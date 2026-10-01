import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { previewSettlement } from "./settlement-store";

// The order preparation fee is a cost the group keeps: the settlement gives
// back what was paid beyond products, shipping and the fee, never the fee.
describeDb("settlement of a cycle with an order preparation fee", () => {
  const scope = makeScope("setfee");
  let cycleId: string;

  beforeAll(async () => {
    await scope.createMember();
    ({ cycleId } = await scope.createCycle("c", { paymentMode: "per_order" }));
    // Paid 13.00; costs 10.00 + 1.00 shipping + 1.10 fee: 0.90 back.
    await scope.createPaidOrderPayment("p", cycleId, 1300);
    await scope.addLedger("oc", scope.memberId, "order_charge", -10, cycleId);
    await scope.addLedger("sc", scope.memberId, "shipping_charge", -1, cycleId);
    await scope.addLedger("hc", scope.memberId, "handling_charge", -1.1, cycleId);
    await scope.sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("refunds only what the fee and the costs did not use", async () => {
    const [m] = (await previewSettlement(getDb(), cycleId)).members;
    expect(m.plan).toEqual({ kind: "refund", refunds: [{ paymentId: `${scope.prefix}_pay_p`, amountCents: 90 }], excessCents: 0 });
  });
});
