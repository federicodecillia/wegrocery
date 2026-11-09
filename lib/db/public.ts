// The only queries of the public page /gruppo, read without a session. Every
// column is listed by name: no member, order, payment or ledger data can
// reach a visitor (lib/db/public.test.ts reads this file to keep it so).

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orderCycles, products } from "@/lib/db/schema";
import { productDisplayOrder } from "@/lib/db/product-order";
import type { PublicCycle } from "@/lib/public-page";

/** Open and planned cycles open to every member ('utenti'), never admin-only ones. */
export async function getPublicCycles(): Promise<PublicCycle[]> {
  const rows = await getDb()
    .select({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      status: orderCycles.status,
      orderOpenAt: orderCycles.orderOpenAt,
      orderCloseAt: orderCycles.orderCloseAt,
      pickupDate: orderCycles.pickupDate,
      pickupEndTime: orderCycles.pickupEndTime,
      datesTentative: orderCycles.datesTentative,
      pickupTentative: orderCycles.pickupTentative,
    })
    .from(orderCycles)
    .where(and(inArray(orderCycles.status, ["open", "planned"]), eq(orderCycles.accessLevel, "utenti")))
    .orderBy(asc(orderCycles.orderCloseAt))
    .limit(20);
  return rows.map((r) => ({ ...r, status: r.status === "open" ? "open" : "planned" }));
}

export type PublicProduct = {
  productId: string;
  name: string;
  variant: string | null;
  format: string | null;
  unit: string | null;
  unitPrice: string;
  emoji: string | null;
  category: string | null;
};

/** The products of a cycle as members see them: name, variant, price. */
export async function getPublicProducts(cycleId: string): Promise<PublicProduct[]> {
  return getDb()
    .select({
      productId: products.productId,
      name: products.name,
      variant: products.variant,
      format: products.format,
      unit: products.unit,
      unitPrice: products.unitPrice,
      emoji: products.emoji,
      category: products.category,
    })
    .from(products)
    .where(and(eq(products.cycleId, cycleId), eq(products.active, true)))
    .orderBy(...productDisplayOrder())
    .limit(300);
}
