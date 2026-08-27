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

  it("derives html from the same text, so the two can never drift apart", () => {
    const { text, html } = supplierOrderEmail(baseInput);
    const textParagraphs = text.trim().split(/\n{2,}/);
    for (const paragraph of textParagraphs) {
      // Every paragraph's text should show up in the html (newlines become
      // <br>, so compare the joined single-line form).
      expect(html).toContain(paragraph.replace(/\n/g, "<br>"));
    }
  });

  it("escapes HTML special characters from the admin-provided cycle title", () => {
    const { html } = supplierOrderEmail({ ...baseInput, cycleTitle: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
