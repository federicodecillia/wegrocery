import ExcelJS from "exceljs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { commitCycleClose } from "@/lib/cycle-close-store";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { buildSupplierDistinta } from "./distinta-builder";
import { parseSupplierDistinta } from "./distinta-parser";

// Closing with the supplier sheet: a sheet built while the cycle is open is
// previewed against the open cycle, then read again after the close. Both
// readings must agree, and a shipping row the supplier left as it was must
// not read as "no shipping" once the close has charged it.
describeDb("supplier sheet at close", () => {
  const scope = makeScope("distclose");
  const { sql } = scope;
  const admin = "admin@example.invalid";
  let other: string;

  beforeAll(async () => {
    await scope.createMember();
    other = await scope.createExtraMember("other");
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  async function order(cycleId: string, productId: string, member: string, line: string, quantity: number, unitPrice: number) {
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot,
        line_total, updated_at)
      VALUES (${scope.id(line)}, ${cycleId}, ${member}, ${productId}, ${quantity}, ${unitPrice},
        ${(quantity * unitPrice).toFixed(2)}, now())`;
  }

  // The supplier's edit: one member's total for one product.
  async function fillCell(file: Buffer, productId: string, memberId: string, value: number): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(file as any);
    const meta = wb.getWorksheet("_meta")!;
    let row = 0;
    let col = 0;
    meta.eachRow((r) => {
      if (r.getCell(1).value === "product" && r.getCell(4).value === productId) row = Number(r.getCell(2).value);
      if (r.getCell(1).value === "member" && r.getCell(4).value === memberId) col = Number(r.getCell(3).value);
    });
    expect(row).toBeGreaterThan(0);
    expect(col).toBeGreaterThan(0);
    wb.getWorksheet("Distinta")!.getCell(row, col).value = value;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it("previews the same corrections before and after the close, and keeps the shipping", async () => {
    const { cycleId, productIds } = await scope.createCycle("veg", {
      shippingCostPerMember: 1.5,
      products: [
        { name: "Lettuce", unitPrice: 1.5 },
        { name: "Pepper", unitPrice: 2 },
      ],
    });
    await order(cycleId, productIds[0], scope.memberId, "l1", 2, 1.5);
    await order(cycleId, productIds[1], other, "l2", 1, 2);

    const built = await buildSupplierDistinta(cycleId);
    const file = await fillCell(built.content, productIds[1], other, 2.4);

    const before = await parseSupplierDistinta(file, cycleId, "d.xlsx", { allowOpenCycle: true });
    expect(before.errors).toEqual([]);
    expect(before.shippingChanges).toEqual([]);
    expect(before.corrections.map((c) => [c.memberId, c.oldTotal, c.newTotal])).toEqual([[other, 2, 2.4]]);

    // Without the option an open cycle is still refused, as in Fornitore.
    expect((await parseSupplierDistinta(file, cycleId, "d.xlsx")).errors).not.toEqual([]);

    await commitCycleClose(getDb(), cycleId, admin);
    const after = await parseSupplierDistinta(file, cycleId, "d.xlsx");
    expect(after.errors).toEqual([]);
    expect(after.shippingChanges).toEqual([]);
    expect(after.corrections.map((c) => [c.memberId, c.oldTotal, c.newTotal])).toEqual([[other, 2, 2.4]]);
  });
});
