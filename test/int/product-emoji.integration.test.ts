import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { upsertCycleProducts } from "@/lib/db/cycle-products";
import { applyProductEmojiEverywhere, loadSavedProductEmojis } from "@/lib/db/product-emoji";
import { productEmojiKey } from "@/lib/products/emoji";
import { describeDb, makeScope } from "./fixtures";

// Product icons on a real database: the icon an import keeps
// (loadSavedProductEmojis), the admin's pick reaching every product with the
// same name (applyProductEmojiEverywhere) and a cycle reload that keeps it.
// Every name carries the run's prefix, so nothing outside the test matches.
describeDb("product icons", () => {
  const scope = makeScope("emoji");
  const { sql, prefix } = scope;
  const db = () => getDb();
  const supplierId = `${prefix}_sup`;
  const cheese = `${prefix} Gorgonzola`;
  const bread = `${prefix} Pane`;

  async function catalogProduct(id: string, name: string, emoji: string | null, active = true) {
    await sql`INSERT INTO supplier_products (catalog_product_id, supplier_id, name, unit_price, emoji, active, created_at)
      VALUES (${`${prefix}_${id}`}, ${supplierId}, ${name}, 5, ${emoji}, ${active}, now())`;
  }

  beforeAll(async () => {
    await sql`INSERT INTO suppliers (supplier_id, name, active, created_at) VALUES (${supplierId}, ${`${prefix} supplier`}, true, now())`;
  });

  afterAll(async () => {
    await sql`DELETE FROM supplier_products WHERE supplier_id = ${supplierId}`;
    await scope.cleanup();
    await sql`DELETE FROM suppliers WHERE supplier_id = ${supplierId}`;
  });

  it("finds the icon in use, catalogue first, never the cart", async () => {
    await catalogProduct("cp1", cheese, "🛒");
    const { productIds } = await scope.createCycle("saved", { products: [{ name: ` ${cheese.toUpperCase()} `, unitPrice: 5 }] });
    await sql`UPDATE products SET emoji = '🧀' WHERE product_id = ${productIds[0]}`;
    let saved = await loadSavedProductEmojis(db(), [cheese, bread]);
    expect(saved.get(productEmojiKey(cheese))).toBe("🧀");
    expect(saved.has(productEmojiKey(bread))).toBe(false);

    await catalogProduct("cp2", cheese, "🍕");
    saved = await loadSavedProductEmojis(db(), [cheese]);
    expect(saved.get(productEmojiKey(cheese))).toBe("🍕");
  });

  it("puts the admin's pick on every product with that name, and only there", async () => {
    await catalogProduct("cp3", bread, "🍞");
    const a = await scope.createCycle("a", { products: [{ name: cheese, unitPrice: 5 }, { name: bread, unitPrice: 3 }] });
    const b = await scope.createCycle("b", { products: [{ name: cheese.toLowerCase(), unitPrice: 6 }] });
    await sql`UPDATE products SET emoji = '🛒' WHERE product_id = ${a.productIds[0]}`;

    const changed = await applyProductEmojiEverywhere(db(), cheese, "🧀");
    expect(changed.catalog).toBeGreaterThanOrEqual(2);
    expect(changed.cycles).toBeGreaterThanOrEqual(2);

    const cat = await sql`SELECT DISTINCT emoji FROM supplier_products WHERE supplier_id = ${supplierId} AND lower(name) = lower(${cheese})`;
    expect(cat.map((r) => r.emoji)).toEqual(["🧀"]);
    const [pa] = await sql`SELECT emoji FROM products WHERE product_id = ${a.productIds[0]}`;
    const [pb] = await sql`SELECT emoji FROM products WHERE product_id = ${b.productIds[0]}`;
    const [pBread] = await sql`SELECT emoji FROM products WHERE product_id = ${a.productIds[1]}`;
    expect([pa.emoji, pb.emoji, pBread.emoji]).toEqual(["🧀", "🧀", null]);
    const [catBread] = await sql`SELECT emoji FROM supplier_products WHERE catalog_product_id = ${`${prefix}_cp3`}`;
    expect(catBread.emoji).toBe("🍞");

    // Applying it again changes nothing.
    expect(await applyProductEmojiEverywhere(db(), cheese, "🧀")).toEqual({ catalog: 0, cycles: 0 });
  });

  it("keeps a chosen icon when the same product is loaded into the cycle again", async () => {
    const { cycleId, productIds } = await scope.createCycle("reload", { products: [{ name: cheese, unitPrice: 5 }] });
    await sql`UPDATE products SET emoji = '🧀' WHERE product_id = ${productIds[0]}`;
    const row = { name: cheese, variant: null, format: null, unitPrice: "5.50", unit: null, supplier: null, notes: null, category: null };
    await upsertCycleProducts(db(), cycleId, [{ ...row, emoji: "🛒" }]);
    const [p] = await sql`SELECT emoji, unit_price FROM products WHERE product_id = ${productIds[0]}`;
    expect([p.emoji, p.unit_price]).toEqual(["🧀", "5.50"]);

    // A cart left by an older import is replaced by a real icon.
    await sql`UPDATE products SET emoji = '🛒' WHERE product_id = ${productIds[0]}`;
    await upsertCycleProducts(db(), cycleId, [{ ...row, emoji: "🧀" }]);
    const [q] = await sql`SELECT emoji FROM products WHERE product_id = ${productIds[0]}`;
    expect(q.emoji).toBe("🧀");
  });
});
