import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { getAdminCycleProducts, getCycleProducts } from "@/lib/db/queries";
import { describeDb, makeScope } from "@/test/int/fixtures";
import {
  findOrderSource,
  readCustomOrderedProducts,
  readCycleOrderState,
  resumeCustomOrder,
  saveCustomProductOrder,
  setAlphabeticalOrder,
} from "./cycle-product-order";

// The product order of a cycle on a real database: alphabetical by default,
// the saved custom order once chosen, nothing written once the cycle closed.
describeDb("product order of a cycle", () => {
  const scope = makeScope("porder");
  const { sql } = scope;
  // Loaded in this order (sort_order 0, 1, 2): not alphabetical on purpose.
  const products = [
    { name: "Zucca", unitPrice: 2 },
    { name: "Arance", unitPrice: 3 },
    { name: "Mele", unitPrice: 1.5 },
  ];

  const names = (rows: { name: string }[]) => rows.map((r) => r.name);

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("is alphabetical by default, whatever the loading order", async () => {
    const { cycleId } = await scope.createCycle("alpha", { products });
    expect((await readCycleOrderState(getDb(), cycleId))?.productOrder).toBe("alpha");
    expect(names(await getCycleProducts(cycleId))).toEqual(["Arance", "Mele", "Zucca"]);
  });

  it("saves a custom order, switches back to alphabetical and resumes it", async () => {
    const db = getDb();
    const { cycleId, productIds } = await scope.createCycle("custom", { products });
    const [zucca, arance, mele] = productIds;

    expect(await saveCustomProductOrder(db, cycleId, [mele, zucca, arance])).toBe("saved");
    const state = await readCycleOrderState(db, cycleId);
    expect(state?.productOrder).toBe("custom");
    expect(state?.savedAt).not.toBeNull();
    expect(names(await getCycleProducts(cycleId))).toEqual(["Mele", "Zucca", "Arance"]);
    expect(names(await getAdminCycleProducts(cycleId))).toEqual(["Mele", "Zucca", "Arance"]);
    expect(names(await getAdminCycleProducts(cycleId, true))).toEqual(["Arance", "Mele", "Zucca"]);

    expect(await setAlphabeticalOrder(db, cycleId)).toBe("saved");
    expect(names(await getCycleProducts(cycleId))).toEqual(["Arance", "Mele", "Zucca"]);

    expect(await resumeCustomOrder(db, cycleId)).toBe("saved");
    expect(names(await getCycleProducts(cycleId))).toEqual(["Mele", "Zucca", "Arance"]);
  });

  it("puts a product missing from the list after the others", async () => {
    const db = getDb();
    const { cycleId, productIds } = await scope.createCycle("partial", { products });
    const [zucca, arance] = productIds;
    await saveCustomProductOrder(db, cycleId, [arance, zucca]);
    const rows = await sql`SELECT name, sort_order FROM products WHERE cycle_id = ${cycleId} ORDER BY sort_order`;
    expect(rows.map((r) => `${r.name}=${r.sort_order}`)).toEqual(["Arance=1", "Zucca=2", "Mele=3"]);
  });

  it("writes nothing once the cycle is closed", async () => {
    const db = getDb();
    const { cycleId, productIds } = await scope.createCycle("closed", { products });
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
    expect(await saveCustomProductOrder(db, cycleId, [...productIds].reverse())).toBe("closed");
    expect(await setAlphabeticalOrder(db, cycleId)).toBe("closed");
    const rows = await sql`SELECT sort_order FROM products WHERE cycle_id = ${cycleId} ORDER BY product_id`;
    expect(rows.map((r) => r.sort_order)).toEqual([0, 1, 2]);
    expect((await readCycleOrderState(db, cycleId))?.productOrder).toBe("alpha");
  });

  it("finds the latest other cycle with a saved custom order and reads it in that order", async () => {
    const db = getDb();
    const source = await scope.createCycle("source", { products });
    const [zucca, arance, mele] = source.productIds;
    await saveCustomProductOrder(db, source.cycleId, [arance, mele, zucca]);
    const target = await scope.createCycle("target", { products });

    const found = await findOrderSource(db, target.cycleId, null);
    expect(found?.cycleId).toBe(source.cycleId);
    expect(names(await readCustomOrderedProducts(db, source.cycleId))).toEqual(["Arance", "Mele", "Zucca"]);
    // A cycle is never its own source.
    expect((await findOrderSource(db, source.cycleId, null))?.cycleId).not.toBe(source.cycleId);
  });
});
