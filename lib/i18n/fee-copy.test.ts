import { describe, expect, it } from "vitest";
import { en } from "./en";
import { it as italian } from "./it";

// Every string of a locale, functions called with sentinel arguments.
function allStrings(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (typeof node === "function") return allStrings((node as (...a: string[]) => unknown)("A", "B", "C", "D", "E"));
  if (Array.isArray(node)) return node.flatMap(allStrings);
  if (node && typeof node === "object") return Object.values(node).flatMap(allStrings);
  return [];
}

const FEE = /spese di preparazione|order preparation fee/i;
const REFUND = /rimbors|restitu|refund|give back|given back|paid back/i;

// The order preparation fee stays with the group: member copy must never promise
// to refund it, only to even out products and shipping at settlement.
describe.each([
  ["it", italian],
  ["en", en],
])("order preparation fee copy (%s)", (name, s) => {
  it("never promises to refund the fee or to give back what was not needed", () => {
    const strings = allStrings(s);
    const feeStrings = strings.filter((x) => FEE.test(x));
    expect(feeStrings.length).toBeGreaterThan(0);
    // A string that talks about the fee and about a refund in one breath.
    // The cancellation copy is the one place where the fee goes back, with the order.
    const promises = feeStrings.filter((x) => REFUND.test(x) && !/annullat|cancel/i.test(x));
    expect(promises).toEqual([]);
    expect(strings.join("\n")).not.toMatch(
      /non è servito|was not needed|gestione e preparazione|handling and order preparation/i,
    );
  });

  it("explains the fee in the guide, for pay-per-order and for the wallet", () => {
    const perOrder = s.guide.faqPerOrder.filter((f) => FEE.test(f.q));
    expect(perOrder).toHaveLength(1);
    const walletFee = s.guide.faq.filter((f) => f.wallet && FEE.test(f.q));
    expect(walletFee).toHaveLength(1);
  });

  it("names the fee, with its own amount, in the paid-order notification", () => {
    const body = s.notificationsServer.orderPaidBody("Cycle", "AMOUNT", "PRODUCTS", "SHIPPING", "FEEAMOUNT");
    expect(body).toMatch(/(spese di preparazione(?: ordine)?|order preparation fee) FEEAMOUNT/i);
    expect(body).not.toMatch(/(?:preparazione ordine|preparation fee) (?:AMOUNT|PRODUCTS|SHIPPING)/i);
  });

  it("gives the fee cap with its currency", () => {
    const withCap = [s.admin.cycle.handlingFeeHint, s.errors.handlingFeeInvalid];
    for (const text of withCap) expect(text).toMatch(/25%.*(€\s?10|10\s?€)/);
  });
});

describe("balance credit hint", () => {
  it("says the difference is the member's credit", () => {
    expect(italian.balance.creditHint).toMatch(/credito a tuo favore/);
    expect(en.balance.creditHint).toMatch(/your credit/);
  });
});
