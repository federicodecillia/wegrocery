"use server";

import { revalidatePath } from "next/cache";
import { requireCycleManager } from "@/lib/auth/manager";
import { t } from "@/lib/i18n";
import { getDb } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { ActionError, actionErrorMessage } from "@/lib/action-error";
import { getAdminCycleProducts } from "@/lib/db/queries";
import {
  findOrderSource,
  readCustomOrderedProducts,
  readCycleOrderState,
  readCycleProductIds,
  resumeCustomOrder,
  saveCustomProductOrder,
  setAlphabeticalOrder,
  type ProductOrderSource,
} from "@/lib/db/cycle-product-order";
import {
  flattenGroups,
  groupCycleProducts,
  orderLikePrevious,
  type ProductOrderMode,
} from "@/lib/products/cycle-order";

// Admin → Ciclo → Prodotti: the order in which the members see the products
// of an open cycle (lib/products/cycle-order.ts, lib/db/cycle-product-order.ts).

type Result = { error?: string; source?: string };

export type CycleProductsData = {
  products: Awaited<ReturnType<typeof getAdminCycleProducts>>;
  productOrder: ProductOrderMode;
  /** The cycle "Usa l'ordine dell'ultimo ciclo" would copy, if any. */
  copySource: ProductOrderSource | null;
};

export async function adminGetCycleProducts(cycleId: string): Promise<CycleProductsData | { error: string }> {
  try {
    await requireCycleManager(cycleId);
    const db = getDb();
    const state = await readCycleOrderState(db, cycleId);
    if (!state) throw new ActionError(t.errors.cycleNotFound);
    const [products, copySource] = await Promise.all([
      getAdminCycleProducts(cycleId),
      findOrderSource(db, cycleId, state.supplierId),
    ]);
    return { products, productOrder: state.productOrder, copySource };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminGetCycleProducts") };
  }
}

/**
 * Alphabetical or custom. The first switch to custom starts from the order
 * the members saw (alphabetical); later ones bring back the saved order.
 */
export async function adminSetCycleProductOrder(cycleId: string, mode: ProductOrderMode): Promise<Result> {
  try {
    const admin = await requireCycleManager(cycleId);
    const db = getDb();
    const state = await readCycleOrderState(db, cycleId);
    if (!state) throw new ActionError(t.errors.cycleNotFound);
    let outcome: "saved" | "closed";
    if (mode === "alpha") outcome = await setAlphabeticalOrder(db, cycleId);
    else if (state.savedAt) outcome = await resumeCustomOrder(db, cycleId);
    else {
      const products = await getAdminCycleProducts(cycleId, true);
      outcome = await saveCustomProductOrder(db, cycleId, flattenGroups(groupCycleProducts(products, "alpha")));
    }
    if (outcome === "closed") throw new ActionError(t.admin.productOrder.cycleNotOpen);
    await audit(db, admin.email, "set_product_order", cycleId, { mode });
    revalidate();
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminSetCycleProductOrder") };
  }
}

/** Saves the order the admin arranged: every id once, all of this cycle. */
export async function adminReorderCycleProducts(cycleId: string, productIds: string[]): Promise<Result> {
  try {
    const admin = await requireCycleManager(cycleId);
    const db = getDb();
    const own = new Set(await readCycleProductIds(db, cycleId));
    const unique = new Set(productIds);
    if (
      !Array.isArray(productIds) ||
      unique.size !== productIds.length ||
      productIds.some((id) => typeof id !== "string" || !own.has(id))
    ) {
      throw new ActionError(t.admin.productOrder.listChanged);
    }
    if ((await saveCustomProductOrder(db, cycleId, productIds)) === "closed") {
      throw new ActionError(t.admin.productOrder.cycleNotOpen);
    }
    await audit(db, admin.email, "reorder_cycle_products", cycleId, { count: productIds.length });
    revalidate();
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminReorderCycleProducts") };
  }
}

/** "Usa l'ordine dell'ultimo ciclo": `source` names the cycle copied. */
export async function adminCopyProductOrderFromPrevious(cycleId: string): Promise<Result> {
  try {
    const admin = await requireCycleManager(cycleId);
    const db = getDb();
    const state = await readCycleOrderState(db, cycleId);
    if (!state) throw new ActionError(t.errors.cycleNotFound);
    const source = await findOrderSource(db, cycleId, state.supplierId);
    if (!source) throw new ActionError(t.admin.productOrder.noSource);
    const [current, previous] = await Promise.all([
      // Alphabetical, whatever the cycle's mode: the new products' order.
      getAdminCycleProducts(cycleId, true).then((rows) => groupCycleProducts(rows, "alpha").flatMap((g) => g.products)),
      readCustomOrderedProducts(db, source.cycleId),
    ]);
    if ((await saveCustomProductOrder(db, cycleId, orderLikePrevious(current, previous))) === "closed") {
      throw new ActionError(t.admin.productOrder.cycleNotOpen);
    }
    await audit(db, admin.email, "copy_product_order", cycleId, { from: source.cycleId });
    revalidate();
    return { source: source.title };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminCopyProductOrderFromPrevious") };
  }
}

async function audit(db: ReturnType<typeof getDb>, email: string, action: string, cycleId: string, payload: unknown) {
  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: email,
    action,
    entityType: "cycle",
    entityId: cycleId,
    payloadJson: JSON.stringify(payload),
    createdAt: new Date(),
  });
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/ordine");
  revalidatePath("/");
}
