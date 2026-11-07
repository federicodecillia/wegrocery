import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// lib/db/public.ts is read by a page without a session: it may only touch the
// cycle and product tables, column by column.
describe("public queries", () => {
  const src = readFileSync("lib/db/public.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("never reads members, orders, payments or the ledger", () => {
    for (const table of ["members", "orders", "orderDrafts", "payments", "ledgerEntries", "refunds", "auditLog", "membershipRequests"]) {
      expect(code, table).not.toMatch(new RegExp(`\\b${table}\\b`));
    }
  });

  it("lists every column: no select() of whole rows", () => {
    expect(code).not.toMatch(/\.select\(\s*\)/);
  });

  it("shows only cycles open to every member", () => {
    expect(code).toMatch(/eq\(orderCycles\.accessLevel, "utenti"\)/);
  });
});
