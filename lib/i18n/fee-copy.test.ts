import { describe, expect, it } from "vitest";
import { en } from "./en";
import { it as italian } from "./it";

// The order preparation fee stays with the group: member copy must never promise
// to refund it, only to even out products and shipping at settlement.
describe.each([
  ["it", italian],
  ["en", en],
])("order preparation fee copy (%s)", (_name, s) => {
  const everything = JSON.stringify(s, (_k, v) => (typeof v === "function" ? v("A", "B", "C", "D", "E") : v));

  it("never promises to refund what was not needed", () => {
    expect(everything).not.toMatch(/non è servito|was not needed|gestione e preparazione|Handling and order preparation|handling and order preparation/);
  });

  it("explains the fee in the guide, for pay-per-order and for the wallet", () => {
    expect(s.guide.faqPerOrder[1].q).toBe(_name === "it" ? "Cosa sono le spese di preparazione ordine?" : "What is the order preparation fee?");
    const walletFee = s.guide.faq.filter((f) => f.wallet && /preparazione ordine|order preparation fee/.test(f.q));
    expect(walletFee).toHaveLength(1);
  });

  it("names the fee in the paid-order notification", () => {
    const body = s.notificationsServer.orderPaidBody("Ciclo", "10,00", "8,00", "1,00", "1,00");
    expect(body).toContain(_name === "it" ? "spese di preparazione ordine 1,00." : "order preparation fee 1,00.");
  });
});
