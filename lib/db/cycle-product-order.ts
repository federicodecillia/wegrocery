import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { normalizeProductOrder, type ProductOrderMode } from "@/lib/products/cycle-order";

// The database side of the product order of a cycle (Admin → Ciclo →
// Prodotti, lib/products/cycle-order.ts). Display only: no price, order or
// ledger row is touched.

type Db = ReturnType<typeof getDb>;

export type CycleOrderState = {
  status: string;
  supplierId: string | null;
  productOrder: ProductOrderMode;
  /** NULL = no custom order saved yet. */
  savedAt: Date | null;
};

export async function readCycleOrderState(db: Db, cycleId: string): Promise<CycleOrderState | null> {
  const { rows } = await db.execute<{
    status: string;
    supplier_id: string | null;
    product_order: string;
    product_order_saved_at: string | null;
  }>(sql`
    SELECT status, supplier_id, product_order, product_order_saved_at
    FROM order_cycles WHERE cycle_id = ${cycleId}
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    status: r.status,
    supplierId: r.supplier_id,
    productOrder: normalizeProductOrder(r.product_order),
    savedAt: r.product_order_saved_at ? new Date(r.product_order_saved_at) : null,
  };
}

/** The ids of the cycle's products (removed ones are deleted, so all of them). */
export async function readCycleProductIds(db: Db, cycleId: string): Promise<string[]> {
  const { rows } = await db.execute<{ product_id: string }>(
    sql`SELECT product_id FROM products WHERE cycle_id = ${cycleId}`,
  );
  return rows.map((r) => r.product_id);
}

/**
 * Saves `productIds` as the cycle's custom order and switches the cycle to
 * it, in one batch, only while the cycle is open. sort_order becomes 1..n in
 * that order; a product of the cycle missing from the list (added in the
 * meantime) goes after them, in its current order. "closed" = the cycle is
 * no longer open and nothing was written.
 */
export async function saveCustomProductOrder(
  db: Db,
  cycleId: string,
  productIds: readonly string[],
): Promise<"saved" | "closed"> {
  const ids = JSON.stringify(productIds);
  const open = sql`EXISTS (SELECT 1 FROM order_cycles WHERE cycle_id = ${cycleId} AND status = 'open')`;
  const [, cycle] = await db.batch([
    db.execute(sql`
      WITH wanted AS (
        SELECT value AS product_id, ordinality AS pos
        FROM jsonb_array_elements_text(${ids}::jsonb) WITH ORDINALITY
      ),
      ranked AS (
        SELECT p.product_id,
               row_number() OVER (ORDER BY w.pos NULLS LAST, p.sort_order, lower(p.name), p.product_id) AS rn
        FROM products p LEFT JOIN wanted w ON w.product_id = p.product_id
        WHERE p.cycle_id = ${cycleId}
      )
      UPDATE products p SET sort_order = r.rn
      FROM ranked r
      WHERE p.product_id = r.product_id AND p.sort_order IS DISTINCT FROM r.rn AND ${open}
    `),
    db.execute<{ cycle_id: string }>(sql`
      UPDATE order_cycles SET product_order = 'custom', product_order_saved_at = now()
      WHERE cycle_id = ${cycleId} AND status = 'open'
      RETURNING cycle_id
    `),
  ]);
  return cycle.rows.length > 0 ? "saved" : "closed";
}

/** Switches the cycle back to alphabetical; its custom order stays saved. */
export async function setAlphabeticalOrder(db: Db, cycleId: string): Promise<"saved" | "closed"> {
  const { rows } = await db.execute<{ cycle_id: string }>(sql`
    UPDATE order_cycles SET product_order = 'alpha'
    WHERE cycle_id = ${cycleId} AND status = 'open'
    RETURNING cycle_id
  `);
  return rows.length > 0 ? "saved" : "closed";
}

/** Switches back to a custom order saved earlier, as it was. */
export async function resumeCustomOrder(db: Db, cycleId: string): Promise<"saved" | "closed"> {
  const { rows } = await db.execute<{ cycle_id: string }>(sql`
    UPDATE order_cycles SET product_order = 'custom'
    WHERE cycle_id = ${cycleId} AND status = 'open'
    RETURNING cycle_id
  `);
  return rows.length > 0 ? "saved" : "closed";
}

export type ProductOrderSource = { cycleId: string; title: string };

/**
 * The cycle whose custom order "Usa l'ordine dell'ultimo ciclo" copies: the
 * latest other cycle with a saved custom order, one of the same supplier
 * first. Cancelled cycles count too: their order was still chosen by hand.
 */
export async function findOrderSource(
  db: Db,
  cycleId: string,
  supplierId: string | null,
): Promise<ProductOrderSource | null> {
  const { rows } = await db.execute<{ cycle_id: string; title: string }>(sql`
    SELECT cycle_id, title FROM order_cycles
    WHERE cycle_id <> ${cycleId} AND product_order = 'custom' AND product_order_saved_at IS NOT NULL
    ORDER BY (supplier_id IS NOT DISTINCT FROM ${supplierId}) DESC, created_at DESC
    LIMIT 1
  `);
  return rows[0] ? { cycleId: rows[0].cycle_id, title: rows[0].title } : null;
}

/** The products of `cycleId` in its custom order, for orderLikePrevious. */
export async function readCustomOrderedProducts(db: Db, cycleId: string) {
  const { rows } = await db.execute<{
    name: string;
    variant: string | null;
    format: string | null;
    unit: string | null;
  }>(sql`
    SELECT name, variant, format, unit FROM products
    WHERE cycle_id = ${cycleId}
    ORDER BY sort_order, lower(name), product_id
  `);
  return rows;
}
