import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { it as italian } from "@/lib/i18n/it";
import { ledgerBadge } from "./ledger-badge";
import { LEDGER_TYPES } from "./movement-label";

const tr = italian.admin.treasury;

function badge(type: string, amount = "-1.00", paymentId: string | null = null) {
  return ledgerBadge({ type, amount, paymentId }, tr);
}

describe("ledgerBadge (Cassa type badge)", () => {
  it("never shows a raw type code for any type the database can hold", () => {
    for (const type of LEDGER_TYPES) {
      for (const amount of ["5.00", "-5.00"]) {
        const { label } = badge(type, amount);
        expect(label, type).not.toBe(type);
        expect(label, type).not.toMatch(/_/);
        expect(label, type).toBe(label.toLowerCase());
      }
    }
  });

  it("names the pay-per-order movements", () => {
    expect(badge("order_payment", "20.00").label).toBe("pagamento ordine");
    expect(badge("order_refund", "-20.00").label).toBe("rimborso carta");
    expect(badge("balance_payment", "8.00").label).toBe("saldo pagato");
  });

  it("names shipping, corrections and reversals", () => {
    expect(badge("shipping_charge").label).toBe("spedizione");
    expect(badge("correction", "-2.00").label).toBe("rettifica");
    expect(badge("correction", "2.00").label).toBe("rimborso");
    expect(badge("reversal").label).toBe("storno");
    expect(badge("adjustment", "30.00").label).toBe("rettifica");
  });

  it("falls back to a generic label, not the raw code, for an unknown type", () => {
    expect(badge("something_new").label).toBe("movimento");
    expect(badge("").label).toBe("movimento");
  });

  it("colours money in teal and money out red or orange", () => {
    expect(badge("topup", "5.00").className).toContain("accent");
    expect(badge("order_charge").className).toContain("red");
    expect(badge("payout").className).toContain("primary");
  });

  it("has the same badge strings in English, none empty", () => {
    for (const labels of [tr, en.admin.treasury]) {
      for (const type of LEDGER_TYPES) {
        expect(ledgerBadge({ type, amount: "1", paymentId: null }, labels).label.length).toBeGreaterThan(0);
      }
    }
  });
});
