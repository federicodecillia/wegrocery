import { describe, expect, it } from "vitest";
import { planMemberSettlement, SETTLEMENT_MIN_DUE_CENTS, type SettlementInput } from "./settlement";

const pay = (paymentId: string, createdAt: string, amountCents: number, refundedCents = 0, requestedCents = 0) => ({
  paymentId,
  createdAt: new Date(createdAt),
  amountCents,
  refundedCents,
  requestedCents,
});
const base: SettlementInput = { memberId: "m", netCents: 0, requestedCents: 0, paysOffline: false, payments: [] };

describe("planMemberSettlement", () => {
  it("has nothing to do when the cycle's net is zero", () => {
    expect(planMemberSettlement(base)).toEqual({ kind: "settled" });
  });

  it("refunds what was paid in excess, from the most recent payment", () => {
    const plan = planMemberSettlement({
      ...base,
      netCents: 900,
      payments: [pay("p1", "2026-10-01T10:00Z", 2500), pay("p2", "2026-10-02T10:00Z", 500)],
    });
    expect(plan).toEqual({
      kind: "refund",
      refunds: [
        { paymentId: "p2", amountCents: 500 },
        { paymentId: "p1", amountCents: 400 },
      ],
      excessCents: 0,
    });
  });

  it("leaves out refunds already on their way, and what a payment cannot give back any more", () => {
    const plan = planMemberSettlement({
      ...base,
      netCents: 1200,
      requestedCents: 300,
      payments: [pay("p1", "2026-10-01T10:00Z", 1000, 200, 300)],
    });
    // target 1200 - 300 = 900; p1 can still refund 1000 - 200 - 300 = 500.
    expect(plan).toEqual({ kind: "refund", refunds: [{ paymentId: "p1", amountCents: 500 }], excessCents: 400 });
  });

  it("asks for the shortfall when it is at least Stripe's minimum", () => {
    expect(planMemberSettlement({ ...base, netCents: -SETTLEMENT_MIN_DUE_CENTS })).toEqual({
      kind: "due",
      dueCents: SETTLEMENT_MIN_DUE_CENTS,
    });
    expect(planMemberSettlement({ ...base, netCents: -1234 })).toEqual({ kind: "due", dueCents: 1234 });
  });

  it("writes off a shortfall under the minimum", () => {
    expect(planMemberSettlement({ ...base, netCents: -49 })).toEqual({ kind: "writeOff", cents: 49 });
  });

  it("leaves members who pay outside the app to Treasury", () => {
    expect(planMemberSettlement({ ...base, netCents: 900, paysOffline: true })).toEqual({ kind: "offline" });
    expect(planMemberSettlement({ ...base, netCents: -900, paysOffline: true })).toEqual({ kind: "offline" });
  });

  it("still refunds the card payments of a member switched to paying outside the app", () => {
    const paid = { paymentId: "p1", createdAt: new Date(1), amountCents: 3000, refundedCents: 0, requestedCents: 0 };
    expect(planMemberSettlement({ ...base, netCents: 500, paysOffline: true, payments: [paid] })).toEqual({
      kind: "refund",
      refunds: [{ paymentId: "p1", amountCents: 500 }],
      excessCents: 0,
    });
  });
});
