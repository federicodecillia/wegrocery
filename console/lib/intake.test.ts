import { describe, expect, it } from "vitest";
import { LIMITS, looksLikeSecret, validateIntake } from "./intake";

const good = {
  groupName: "GAS Riva",
  contactName: "Anna Bianchi",
  contactEmail: "Anna@Example.org",
  city: "Trento",
  membersEstimate: "40",
  locale: "it",
  currency: "eur",
  timeZone: "Europe/Rome",
  emailDomain: "gasriva.it",
  paymentMode: "per_order",
  hostingPreference: "group_owned",
  onlinePayments: "on",
  privacy: "on",
};

describe("validateIntake", () => {
  it("accepts a complete request", () => {
    const r = validateIntake(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.contactEmail).toBe("anna@example.org");
    expect(r.data.currency).toBe("EUR");
    expect(r.data.membersEstimate).toBe(40);
    expect(r.data.onlinePayments).toBe(true);
    expect(r.data.googleLogin).toBe(false);
    expect(r.data.paymentMode).toBe("per_order");
    expect(r.data.hostingPreference).toBe("group_owned");
  });

  it("requires the essentials and the privacy consent", () => {
    const r = validateIntake({});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["contactEmail", "contactName", "groupName", "privacy"]);
  });

  it("validates email, domain, number, time zone and logo", () => {
    const r = validateIntake({ ...good, contactEmail: "nope", emailDomain: "not a domain", membersEstimate: "-2", timeZone: "Nowhere/City", logoUrl: "http://x.example/l.png" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["contactEmail", "emailDomain", "logoUrl", "membersEstimate", "timeZone"]);
  });

  it("enforces length limits", () => {
    const r = validateIntake({ ...good, notes: "x".repeat(LIMITS.notes + 1) });
    expect(r.ok).toBe(false);
  });

  it("refuses a pasted secret", () => {
    const r = validateIntake({ ...good, notes: "ecco la chiave sk_live_abcdefghij1234" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.notes).toBeDefined();
  });

  it("flags the honeypot as spam", () => {
    const r = validateIntake({ ...good, website: "http://spam" });
    expect(r).toEqual({ ok: false, errors: {}, spam: true });
  });
});

describe("looksLikeSecret", () => {
  it("spots keys and connection strings", () => {
    expect(looksLikeSecret("my key sk_live_abcdefghij1234")).toBe(true);
    expect(looksLikeSecret("postgresql://user:pw@host/db")).toBe(true);
    expect(looksLikeSecret("re_abcdefghijklmnopqrstu")).toBe(true);
    expect(looksLikeSecret("Siamo un gruppo di 40 famiglie")).toBe(false);
  });
});
