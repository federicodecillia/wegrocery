import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { guessProductCategory } from "@/lib/utils";

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

// Idempotent upsert of products into a cycle. Used by every "load products"
// path (text paste, catalogue picker, listing wizard). Match key:
// (name, variant, format, unit) all lower/trimmed — same product reloaded
// with a new price updates the row instead of creating a duplicate.
//
// Lives in lib/db rather than lib/actions so it can be imported from any
// "use server" file without Next.js complaining about non-serialisable args.
export async function upsertCycleProducts(
  db: ReturnType<typeof getDb>,
  cycleId: string,
  newProducts: Array<{
    name: string;
    variant: string | null;
    format: string | null;
    unitPrice: string | number;
    pricePerKg?: string | number | null;
    unit: string | null;
    supplier: string | null;
    notes: string | null;
    category: string | null;
    supplierId?: string | null;
    emoji?: string | null;
  }>,
) {
  const existingProducts = await db
    .select()
    .from(products)
    .where(eq(products.cycleId, cycleId));

  const [maxSortRow] = await db
    .select({ max: sql<number>`max(${products.sortOrder})` })
    .from(products)
    .where(eq(products.cycleId, cycleId));
  let currentSort = maxSortRow?.max || 0;

  const existingMap = new Map<string, (typeof existingProducts)[number] | true>();
  for (const p of existingProducts) {
    const key = `${p.name.toLowerCase().trim()}|${p.variant?.toLowerCase().trim() || ""}|${p.format?.toLowerCase().trim() || ""}|${p.unit?.toLowerCase().trim() || ""}`;
    existingMap.set(key, p);
  }

  const inserts = [];
  for (const np of newProducts) {
    const key = `${np.name.toLowerCase().trim()}|${np.variant?.toLowerCase().trim() || ""}|${np.format?.toLowerCase().trim() || ""}|${np.unit?.toLowerCase().trim() || ""}`;
    const existing = existingMap.get(key);
    const unitPriceStr = typeof np.unitPrice === "number" ? np.unitPrice.toFixed(2) : np.unitPrice;
    const pricePerKgStr =
      np.pricePerKg == null
        ? null
        : typeof np.pricePerKg === "number"
          ? np.pricePerKg.toFixed(2)
          : np.pricePerKg;
    // The deterministic name-based guess wins whenever it recognizes the
    // product, regardless of what category the caller passed in — a raw
    // supplier file column, or a stale value already sitting on a catalogue
    // entry from an older import. This is the single place every "load
    // products into a cycle" path funnels through, so fixing it here keeps
    // the same product name landing in the same category everywhere it's
    // loaded from (catalogue picker included), not just on fresh imports.
    const guessedCategory = guessProductCategory(np.name);

    if (existing && existing !== true) {
      await db
        .update(products)
        .set({
          unitPrice: unitPriceStr,
          pricePerKg: pricePerKgStr ?? existing.pricePerKg,
          notes: np.notes || existing.notes,
          category: guessedCategory ?? (np.category || existing.category),
          supplier: np.supplier || existing.supplier,
          supplierId: np.supplierId ?? existing.supplierId,
          emoji: np.emoji || existing.emoji,
          active: true,
        })
        .where(eq(products.productId, existing.productId));
    } else if (!existing) {
      currentSort++;
      inserts.push({
        productId: genId("prd"),
        cycleId,
        name: np.name.trim(),
        variant: np.variant?.trim() || null,
        format: np.format?.trim() || null,
        unit: np.unit?.trim() || null,
        unitPrice: unitPriceStr,
        pricePerKg: pricePerKgStr,
        supplier: np.supplier?.trim() || null,
        supplierId: np.supplierId?.trim() || null,
        notes: np.notes?.trim() || null,
        sortOrder: currentSort,
        active: true,
        category: guessedCategory ?? (np.category?.trim() || null),
        emoji: np.emoji?.trim() || null,
      });
      existingMap.set(key, true);
    }
  }

  if (inserts.length > 0) {
    await db.insert(products).values(inserts);
  }
}
