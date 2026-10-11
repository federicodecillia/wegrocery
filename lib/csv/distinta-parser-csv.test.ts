import { describe, it as test, expect, vi, beforeEach } from "vitest";
import * as schema from "@/lib/db/schema";
import { t } from "@/lib/i18n";

// A fake Drizzle client: every select resolves to the rows set for the table
// passed to from(). Enough for the CSV collector and the preview diff.
const rows = new Map<unknown, unknown[]>();
vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    select: () => {
      let table: unknown;
      const q: Record<string, unknown> = {};
      const self = () => q;
      q.from = (tbl: unknown) => {
        table = tbl;
        return q;
      };
      q.where = self;
      q.innerJoin = self;
      q.leftJoin = self;
      q.limit = self;
      q.then = (resolve: (v: unknown) => void) => resolve(rows.get(table) ?? []);
      return q;
    },
  }),
}));

import { parseSupplierDistinta } from "./distinta-parser";

// The shape Excel on Windows writes for a distinta saved as "CSV": comma
// separated, decimals with a comma and therefore quoted, CRLF line ends,
// Windows-1252 bytes (é = 0xE9). Names are invented.
function excelCsv(): Buffer {
  const c = t.csv;
  const lines = [
    "Ordine 07/10 \x97 Distinta,,,,,,,,",
    ",,,,,,,,",
    `${c.columnProduct},${c.columnVariant},${c.columnFormat},${c.columnPricePerUnit},${c.columnPricePerKg},${c.columnNotes},Anna Bianchi,Zo\xe9 Verdi,${c.columnTotalProduct}`,
    'cavolo,nero,300 g,"1,35",,,"1,40",,"1,40"',
    'lattuga,,300 g,"1,50",,,"1,50","1,20","2,70"',
    ",,,,,,,,",
    `${c.shippingLabel},,,,,,"0,60","0,60","1,20"`,
  ];
  return Buffer.from(lines.join("\r\n") + "\r\n", "latin1");
}

function seed({ applied }: { applied: boolean }) {
  rows.set(schema.members, [
    { memberId: "m1", fullName: "Anna Bianchi" },
    { memberId: "m2", fullName: "Zoé Verdi" },
  ]);
  rows.set(schema.products, [
    { productId: "p1", name: "cavolo", variant: "nero" },
    { productId: "p2", name: "lattuga", variant: null },
  ]);
  rows.set(schema.orderCycles, [{ cycleId: "c1", title: "Ordine", status: "closed" }]);
  const line = (id: string, memberId: string, productId: string, productName: string, ordered: string, actual: string) => ({
    orderLineId: id,
    memberId,
    productId,
    productName,
    lineTotal: ordered,
    actualLineTotal: applied ? actual : null,
  });
  rows.set(schema.orders, [
    line("o1", "m1", "p1", "cavolo", "1.35", "1.40"),
    line("o2", "m1", "p2", "lattuga", "1.50", "1.50"),
    line("o3", "m2", "p2", "lattuga", "1.50", "1.20"),
  ]);
  rows.set(schema.ledgerEntries, [
    { memberId: "m1", amount: "-0.60" },
    { memberId: "m2", amount: "-0.60" },
  ]);
}

describe("parseSupplierDistinta with an Excel CSV", () => {
  beforeEach(() => rows.clear());

  test("matches members (accents included) and products, and finds the corrections", async () => {
    seed({ applied: false });
    const p = await parseSupplierDistinta(excelCsv(), "c1", "distinta.csv");
    expect(p.errors).toEqual([]);
    expect(p.warnings).toEqual([]);
    expect(p.matched).toEqual({ products: 2, members: 2, lines: 3 });
    expect(p.corrections.map((c) => [c.orderLineId, c.newTotal])).toEqual([
      ["o1", 1.4],
      ["o3", 1.2],
    ]);
    expect(p.shippingChanges).toEqual([]);
  });

  test("reports everything matched but nothing to apply once the corrections are in", async () => {
    seed({ applied: true });
    const p = await parseSupplierDistinta(excelCsv(), "c1", "distinta.csv");
    expect(p.errors).toEqual([]);
    expect(p.corrections).toEqual([]);
    expect(p.shippingChanges).toEqual([]);
    expect(p.matched).toEqual({ products: 2, members: 2, lines: 3 });
  });
});
