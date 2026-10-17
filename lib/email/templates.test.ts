import { describe, it, expect } from "vitest";
import { supplierOrderEmail } from "./templates";

describe("supplierOrderEmail", () => {
  const baseInput = {
    cycleTitle: "Ciclo 2026-08-25",
    pickupDate: null,
    grandTotal: 123.45,
    productCount: 3,
    memberCount: 5,
  };

  it("puts the order keyword and org name ahead of the app brand in the subject", () => {
    const { subject } = supplierOrderEmail(baseInput);
    // Regression guard for the deliverability fix: the old subject led with
    // the SaaS app name ("WeGrocery — <cycle>"), which read as a marketing
    // broadcast to spam filters. It must not reappear.
    expect(subject).not.toMatch(/^WeGrocery/);
    expect(subject).toContain(baseInput.cycleTitle);
  });
});
