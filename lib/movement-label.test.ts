import { describe, expect, it } from "vitest";
import { it as italian } from "@/lib/i18n/it";
import { movementDateHasTime, movementKind, movementLabel, movementRecorder, movementText } from "./movement-label";

const labels = italian.history;

function label(type: string, amount: string, paymentId: string | null = null) {
  return movementLabel({ type, amount, paymentId }, labels);
}

describe("movementLabel", () => {
  it("names top-ups by channel, never as a bank transfer", () => {
    expect(label("topup", "20.00", "pay_1")).toBe("Ricarica online");
    expect(label("topup", "20.00")).toBe("Ricarica");
  });

  it("names the charges a cycle close posts", () => {
    expect(label("order_charge", "-18.40")).toBe("Ordine");
    expect(label("shipping_charge", "-2.00")).toBe("Spedizione");
  });

  it("names a correction by its direction", () => {
    expect(label("correction", "1.60")).toBe("Rimborso");
    expect(label("correction", "-0.80")).toBe("Rettifica");
  });

  it("names a Stripe refund of an online top-up going back to the card", () => {
    expect(label("correction", "-5.00", "pay_1")).toBe("Rimborso ricarica online");
  });

  it("keeps the legacy adjustment as a neutral correction whatever its sign", () => {
    expect(label("adjustment", "30.00")).toBe("Rettifica");
    expect(label("adjustment", "-3.00")).toBe("Rettifica");
  });

  it("names the manual movements recorded from Cassa", () => {
    expect(label("payout", "-12.00")).toBe("Restituzione saldo");
    expect(label("manual_charge", "-4.00")).toBe("Addebito");
    expect(label("membership_fee", "-15.00")).toBe("Quota associativa");
  });

  it("falls back to a generic label for a type it does not know", () => {
    expect(label("reversal", "-1.00")).toBe("Movimento");
  });

  it("accepts numeric amounts and treats a sign-less correction as a correction", () => {
    expect(movementLabel({ type: "correction", amount: 2, paymentId: null }, labels)).toBe("Rimborso");
    expect(label("correction", "0.00")).toBe("Rettifica");
    expect(label("correction", "NaN")).toBe("Rettifica");
  });
});

describe("movementText", () => {
  function text(type: string, amount: string, note: string | null, paymentId: string | null = null) {
    return movementText({ type, amount, note, paymentId }, labels);
  }

  it("shows the label alone when there is no note", () => {
    expect(text("order_charge", "-18.40", null)).toBe("Ordine");
    expect(text("correction", "1.00", "   ")).toBe("Rimborso");
  });

  it("appends a note that adds information", () => {
    expect(text("order_charge", "-18.40", "Addebito ordine")).toBe("Ordine · Addebito ordine");
    expect(text("topup", "50.00", "Contanti")).toBe("Ricarica · Contanti");
    expect(text("correction", "1.60", "Patate: 1 kg ordinati, 0.8 kg ricevuti")).toBe(
      "Rimborso · Patate: 1 kg ordinati, 0.8 kg ricevuti",
    );
  });

  it("lets a note that starts with the label stand for it instead of repeating it", () => {
    expect(text("topup", "50.00", "Ricarica")).toBe("Ricarica");
    expect(text("shipping_charge", "-2.00", "Spedizione")).toBe("Spedizione");
    expect(text("shipping_charge", "-1.50", "Spedizione rettificata")).toBe("Spedizione rettificata");
    expect(text("shipping_charge", "-1.20", "Spedizione (quota proporzionale)")).toBe(
      "Spedizione (quota proporzionale)",
    );
  });

  it("drops the fixed note of a Stripe row, which only repeats the label", () => {
    expect(text("topup", "20.00", "Ricarica online", "pay_1")).toBe("Ricarica online");
    expect(text("correction", "-5.00", "Rimborso ricarica online", "pay_1")).toBe(
      "Rimborso ricarica online",
    );
  });
});

describe("movementKind", () => {
  const kind = (type: string, amount: string | number, paymentId: string | null = null) =>
    movementKind({ type, amount, paymentId });

  it("tells a bank or cash top-up from an online one", () => {
    expect(kind("topup", "20.00")).toBe("topup");
    expect(kind("topup", "20.00", "pay_1")).toBe("online_topup");
  });

  it("gives the order and its shipping their own kinds", () => {
    expect(kind("order_charge", "-18.40")).toBe("order");
    expect(kind("shipping_charge", "-2.00")).toBe("shipping");
  });

  it("splits corrections into refunds, online refunds and adjustments", () => {
    expect(kind("correction", "1.60")).toBe("refund");
    expect(kind("correction", "-5.00", "pay_1")).toBe("online_refund");
    expect(kind("correction", "-0.80")).toBe("adjustment");
    expect(kind("correction", 0)).toBe("adjustment");
    expect(kind("adjustment", "30.00")).toBe("adjustment");
  });

  it("names the manual movements recorded from Cassa", () => {
    expect(kind("payout", "-12.00")).toBe("payout");
    expect(kind("manual_charge", "-4.00")).toBe("manual_charge");
    expect(kind("membership_fee", "-15.00")).toBe("membership_fee");
  });

  it("falls back to other for a type it does not know", () => {
    expect(kind("mystery", "1.00")).toBe("other");
  });
});

describe("movementRecorder", () => {
  it("credits online rows to the online payment, whatever the row names", () => {
    expect(movementRecorder({ paymentId: "pay_1", recorderName: null })).toEqual({ kind: "online" });
    expect(movementRecorder({ paymentId: "pay_1", recorderName: "Alice" })).toEqual({ kind: "online" });
  });

  it("names the admin who recorded the row", () => {
    expect(movementRecorder({ paymentId: null, recorderName: " Alice Smith " })).toEqual({
      kind: "admin",
      name: "Alice Smith",
    });
  });

  it("falls back to the system when nobody matches", () => {
    expect(movementRecorder({ paymentId: null, recorderName: null })).toEqual({ kind: "system" });
    expect(movementRecorder({ paymentId: null, recorderName: "  " })).toEqual({ kind: "system" });
  });
});

describe("movementDateHasTime", () => {
  it("drops the time of a movement dated by day in Cassa (UTC midnight)", () => {
    expect(movementDateHasTime(new Date("2026-09-29T00:00:00.000Z"))).toBe(false);
  });

  it("keeps the time of movements the app timestamps", () => {
    expect(movementDateHasTime(new Date("2026-09-23T22:00:00.000Z"))).toBe(true);
    expect(movementDateHasTime(new Date("2026-09-29T14:31:05.123Z"))).toBe(true);
  });
});
