import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { readModeChangeState } from "./mode-change";

// The counts behind "what stops the change" move with the cycles.
describeDb("payment mode change state", () => {
  const scope = makeScope("mode");
  const { sql } = scope;

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("counts a running cycle, then the same cycle closed with money and not settled", async () => {
    const before = await readModeChangeState(getDb());
    const { cycleId } = await scope.createCycle("c", { paymentMode: "per_order" });
    await scope.createPaidOrderPayment("p", cycleId, 1000);
    const open = await readModeChangeState(getDb());
    expect(open.runningCycles).toBe(before.runningCycles + 1);
    expect(open.unsettledCycles).toBe(before.unsettledCycles);

    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
    const closed = await readModeChangeState(getDb());
    expect(closed.runningCycles).toBe(before.runningCycles);
    expect(closed.unsettledCycles).toBe(before.unsettledCycles + 1);

    // Settled, but the 10.00 paid and never charged can still go back to the
    // card: not settled yet.
    await sql`UPDATE order_cycles SET settled_at = now() WHERE cycle_id = ${cycleId}`;
    expect((await readModeChangeState(getDb())).unsettledCycles).toBe(before.unsettledCycles + 1);
    await scope.addLedger("charge", scope.memberId, "order_charge", -10, cycleId);
    expect((await readModeChangeState(getDb())).unsettledCycles).toBe(before.unsettledCycles);
  });
});
