import { and, sql } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { products, supplierProducts } from "@/lib/db/schema";
import { FALLBACK_PRODUCT_EMOJI, isChosenEmoji, productEmojiKey } from "@/lib/products/emoji";

type Db = ReturnType<typeof getDb>;

// The icon the group already uses for each of `names` (keyed by
// productEmojiKey), from the supplier catalogue first (active and newest
// first), then from the products of the most recent cycles. The cart and
// empty icons are left out, so a name only ever stored with the cart has no
// entry and falls back to the name match.
export async function loadSavedProductEmojis(db: Db, names: ReadonlyArray<string>): Promise<Map<string, string>> {
  const keys = Array.from(new Set(names.map(productEmojiKey).filter(Boolean)));
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  const list = sql.join(
    keys.map((k) => sql`${k}`),
    sql`, `,
  );
  const { rows } = await db.execute<{ key: string; emoji: string }>(sql`
    SELECT DISTINCT ON (key) key, emoji FROM (
      SELECT lower(btrim(name)) AS key, btrim(emoji) AS emoji, 0 AS src,
             CASE WHEN active THEN 0 ELSE 1 END AS inactive, created_at AS ts
        FROM supplier_products
       WHERE lower(btrim(name)) IN (${list})
      UNION ALL
      SELECT lower(btrim(p.name)), btrim(p.emoji), 1, 0, c.created_at
        FROM products p JOIN order_cycles c ON c.cycle_id = p.cycle_id
       WHERE lower(btrim(p.name)) IN (${list})
    ) s
    WHERE emoji IS NOT NULL AND emoji <> '' AND emoji <> ${FALLBACK_PRODUCT_EMOJI}
    ORDER BY key, src, inactive, ts DESC
  `);
  for (const r of rows) if (isChosenEmoji(r.emoji)) out.set(r.key, r.emoji);
  return out;
}

// An admin chose `emoji` for a product: every product with the same name
// gets it, in the supplier catalogues and in every cycle (open, planned and
// past), so the next import, the catalogue and the order page all agree.
// Only the icon changes; prices, orders and the ledger are untouched.
export async function applyProductEmojiEverywhere(
  db: Db,
  name: string,
  emoji: string,
): Promise<{ catalog: number; cycles: number }> {
  const key = productEmojiKey(name);
  const icon = emoji.trim();
  if (!key || !icon) return { catalog: 0, cycles: 0 };
  const [catalog, cycles] = await db.batch([
    db
      .update(supplierProducts)
      .set({ emoji: icon })
      .where(
        and(
          sql`lower(btrim(${supplierProducts.name})) = ${key}`,
          sql`${supplierProducts.emoji} IS DISTINCT FROM ${icon}`,
        ),
      )
      .returning({ id: supplierProducts.catalogProductId }),
    db
      .update(products)
      .set({ emoji: icon })
      .where(and(sql`lower(btrim(${products.name})) = ${key}`, sql`${products.emoji} IS DISTINCT FROM ${icon}`))
      .returning({ id: products.productId }),
  ]);
  return { catalog: catalog.length, cycles: cycles.length };
}
