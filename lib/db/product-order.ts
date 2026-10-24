import { asc, sql } from "drizzle-orm";
import { orderCycles, products } from "@/lib/db/schema";

// ORDER BY of a cycle's products as the members see them inside a category
// (lib/products/cycle-order.ts groups them): a custom cycle by
// products.sort_order, then alphabetical by product, variety, format and
// price, so every "Cicoria" variant sits together. LOWER(...) keeps it
// case-insensitive. Reads the cycle's mode itself, so any query on products
// can use it; `alphabetical` ignores the mode.
export function productDisplayOrder(alphabetical = false) {
  const custom = sql`case when (select ${orderCycles.productOrder} from ${orderCycles} where ${orderCycles.cycleId} = ${products.cycleId}) = 'custom' then ${products.sortOrder} else 0 end`;
  return [
    ...(alphabetical ? [] : [custom]),
    sql`lower(${products.name})`,
    sql`lower(coalesce(${products.variant}, ''))`,
    sql`lower(coalesce(${products.format}, ''))`,
    asc(products.unitPrice),
  ];
}
