import { describe, expect, it } from "vitest";
import { handoverSubject, handoverText } from "./handover";

describe("handover", () => {
  const base = { groupName: "GAS Riva", appUrl: "https://gas.riva.it", adminEmail: "anna@riva.it", emailOnSharedDomain: false, paymentsConfigured: true };

  it("names the link and the address to sign in with", () => {
    const t = handoverText(base);
    expect(t).toContain("https://gas.riva.it");
    expect(t).toContain("accedi con anna@riva.it");
    expect(t).not.toContain("dominio condiviso");
    expect(t).not.toContain("Stripe");
  });

  it("mentions the shared domain and the missing payments", () => {
    const t = handoverText({ ...base, emailOnSharedDomain: true, paymentsConfigured: false });
    expect(t).toContain("dominio condiviso");
    expect(t).toContain("Stripe");
  });

  it("has a subject", () => {
    expect(handoverSubject("GAS Riva")).toContain("GAS Riva");
  });
});
