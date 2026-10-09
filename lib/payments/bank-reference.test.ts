import { describe, expect, it } from "vitest";
import {
  BANK_REFERENCE_MAX,
  checkBankReferenceTemplate,
  fillBankReference,
  isValidReceiptEmail,
  normalizeBankReferenceTemplate,
  paidByBankTransfer,
  referenceMonthYear,
} from "./bank-reference";

const values = { order: "Verdura di stagione", month: "ottobre", year: "2026", member: "Maria Rossi" };

describe("fillBankReference", () => {
  it("fills the Italian and the English placeholders", () => {
    expect(fillBankReference("Rimborso spese ordine {ordine} {mese} {anno} {socio}", values)).toBe(
      "Rimborso spese ordine Verdura di stagione ottobre 2026 Maria Rossi",
    );
    expect(fillBankReference("Order {order} {MONTH} { year } {member}", values)).toBe(
      "Order Verdura di stagione ottobre 2026 Maria Rossi",
    );
  });

  it("leaves an unknown placeholder as written and collapses spaces", () => {
    expect(fillBankReference("  {ordine}   {altro} ", values)).toBe("Verdura di stagione {altro}");
  });

  it("cuts a long reference at the SEPA limit", () => {
    const long = fillBankReference("{ordine} {socio}", { ...values, order: "x".repeat(200) });
    expect(long.length).toBe(BANK_REFERENCE_MAX);
  });
});

describe("checkBankReferenceTemplate", () => {
  it("accepts the known placeholders and plain text", () => {
    expect(checkBankReferenceTemplate("Ordine {ordine} {mese} {anno} {socio}")).toBeNull();
    expect(checkBankReferenceTemplate("Spesa GAS")).toBeNull();
  });

  it("refuses an unknown placeholder and a template over the limit", () => {
    expect(checkBankReferenceTemplate("Ordine {nome}")).toBe("unknownPlaceholder");
    expect(checkBankReferenceTemplate("x".repeat(BANK_REFERENCE_MAX + 1))).toBe("tooLong");
  });
});

describe("normalizeBankReferenceTemplate", () => {
  it("keeps one line and turns blanks into null", () => {
    expect(normalizeBankReferenceTemplate(" a\n  b ")).toBe("a b");
    expect(normalizeBankReferenceTemplate("  ")).toBeNull();
  });
});

describe("referenceMonthYear", () => {
  it("writes the month out in the group's zone", () => {
    // 31 October 23:30 UTC is already November in Rome.
    const date = new Date("2026-10-31T23:30:00Z");
    expect(referenceMonthYear(date, "it-IT", "Europe/Rome")).toEqual({ month: "novembre", year: "2026" });
    expect(referenceMonthYear(date, "en-GB", "UTC")).toEqual({ month: "October", year: "2026" });
  });
});

describe("isValidReceiptEmail", () => {
  it("checks the shape only", () => {
    expect(isValidReceiptEmail("gas@example.org")).toBe(true);
    expect(isValidReceiptEmail("gas@example")).toBe(false);
    expect(isValidReceiptEmail("g as@example.org")).toBe(false);
  });
});

describe("paidByBankTransfer", () => {
  it("covers closed wallet cycles, and card cycles only for who pays outside the app", () => {
    expect(paidByBankTransfer({ status: "closed", paymentMode: "wallet" }, false)).toBe(true);
    expect(paidByBankTransfer({ status: "open", paymentMode: "wallet" }, false)).toBe(false);
    expect(paidByBankTransfer({ status: "cancelled", paymentMode: "wallet" }, false)).toBe(false);
    expect(paidByBankTransfer({ status: "closed", paymentMode: "per_order" }, false)).toBe(false);
    expect(paidByBankTransfer({ status: "closed", paymentMode: "per_order" }, true)).toBe(true);
  });
});
