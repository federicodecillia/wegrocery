import { eq } from "drizzle-orm";
import { ActionError } from "@/lib/action-error";
import { getDb } from "@/lib/db/client";
import { orderCycles, orders, products } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { canAccessCycle } from "@/lib/roles";
import { requireOrderManager, type GuardedMember } from "./session";

// The Admin guards for the order work an admin shares with a "Referente
// ordini" (lib/roles.ts AdminAccess). A referent works only on the cycles
// their role lets them see (canAccessCycle), exactly as they would see them
// as a member; an admin on every cycle. Plain server module: the "use server"
// actions import it.

type Manager = GuardedMember & { access: "admin" | "referent" };

/** Whether this manager may work on a cycle with this access level. */
export function managesCycle(manager: Pick<Manager, "access" | "role">, accessLevel: string): boolean {
  return manager.access === "admin" || canAccessCycle(accessLevel, manager.role);
}

/**
 * An admin, or a referent who can see the cycle. A cycle the referent cannot
 * see reads as not found, so its existence does not leak.
 */
export async function requireCycleManager(cycleId: string): Promise<Manager> {
  const manager = await requireOrderManager();
  if (manager.access === "admin") return manager;
  const [cycle] = await getDb()
    .select({ accessLevel: orderCycles.accessLevel })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!cycle || !managesCycle(manager, cycle.accessLevel)) throw new ActionError(t.errors.cycleNotFound);
  return manager;
}

/** requireCycleManager for the cycle a cycle product belongs to. */
export async function requireProductManager(productId: string): Promise<Manager> {
  const [row] = await getDb()
    .select({ cycleId: products.cycleId })
    .from(products)
    .where(eq(products.productId, productId))
    .limit(1);
  if (!row) {
    await requireOrderManager();
    throw new ActionError(t.errors.productNotFound(productId));
  }
  return requireCycleManager(row.cycleId);
}

/** requireCycleManager for the cycle an order line belongs to. */
export async function requireOrderLineManager(orderLineId: string): Promise<Manager> {
  const [row] = await getDb()
    .select({ cycleId: orders.cycleId })
    .from(orders)
    .where(eq(orders.orderLineId, orderLineId))
    .limit(1);
  if (!row) {
    await requireOrderManager();
    throw new ActionError(t.errors.genericError);
  }
  return requireCycleManager(row.cycleId);
}
