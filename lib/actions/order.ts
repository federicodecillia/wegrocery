"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { getDb } from "@/lib/db/client";
import { auditLog, orders } from "@/lib/db/schema";
import {
  getCycleProducts,
  getLastMemberOrderForPrefill,
  getMemberBalance,
  getMemberByEmail,
  getOpenCycles,
} from "@/lib/db/queries";
import { canAccessCycle } from "@/lib/utils";

export type SaveOrderLine = { productId: string; quantity: number };

export async function saveOrder(
  cycleId: string,
  lines: SaveOrderLine[],
): Promise<{ success: boolean; balanceWarning: string | null }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const member = await getMemberByEmail(email);
  if (!member) throw new Error(t.errors.memberNotFound);
  if (!member.active) throw new Error(t.errors.accountInactive);

  // The schema stores quantities as integers; reject anything the DB would
  // choke on (fractions, negatives, absurd values) before touching the order.
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 0 || l.quantity > 9999) {
      throw new Error(t.errors.invalidQuantity);
    }
  }

  const cycles = await getOpenCycles();
  const cycle = cycles.find((c) => c.cycleId === cycleId);
  if (!cycle) {
    throw new Error(t.errors.cycleNotOpen);
  }
  if (!canAccessCycle(cycle.accessLevel, member.role)) {
    throw new Error(t.errors.accessDenied);
  }

  const cycleProducts = await getCycleProducts(cycleId);
  const productMap = new Map(cycleProducts.map((p) => [p.productId, p]));

  const db = getDb();
  const now = new Date();
  const newLines = lines.filter((l) => l.quantity > 0);

  // The Neon HTTP driver has no session to hold BEGIN...COMMIT across separate
  // round-trips, so delete + insert as two awaits could be interrupted between
  // the two, silently leaving the member's order empty. db.batch() ships both
  // statements in one HTTP request and Neon runs them in a single transaction,
  // so they succeed or fail together.
  //
  // The guard statement closes the race with performCycleClose (issue #84):
  // it row-locks the cycle inside this transaction, so a concurrent close CAS
  // waits until our write commits (and then charges these fresh rows), and if
  // the close committed first the CASE yields 0 and the division error rolls
  // back the whole batch — no order row can land on a closed cycle uncharged.
  const guardCycleStillOpen = db.execute(
    sql`SELECT 1 / (CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_guard
        FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`,
  );
  const deleteExisting = db
    .delete(orders)
    .where(and(eq(orders.memberId, member.memberId), eq(orders.cycleId, cycleId)));

  try {
    if (newLines.length > 0) {
      const insertNew = db.insert(orders).values(
        newLines.map((l) => {
          const product = productMap.get(l.productId);
          if (!product) throw new Error(t.errors.productNotFound(l.productId));
          const lineTotal = (parseFloat(product.unitPrice) * l.quantity).toFixed(2);
          return {
            orderLineId: crypto.randomUUID(),
            cycleId,
            memberId: member.memberId,
            productId: l.productId,
            quantity: l.quantity,
            unitPriceSnapshot: product.unitPrice,
            lineTotal,
            updatedAt: now,
          };
        }),
      );
      await db.batch([guardCycleStillOpen, deleteExisting, insertNew]);
    } else {
      await db.batch([guardCycleStillOpen, deleteExisting]);
    }
  } catch (err) {
    // 22012 = division_by_zero, i.e. the guard found the cycle closed.
    if (err instanceof Error && /22012|division by zero/i.test(err.message)) {
      throw new Error(t.errors.cycleNotOpen);
    }
    throw err;
  }

  const total = newLines.reduce((sum, l) => {
    const p = productMap.get(l.productId)!;
    return sum + parseFloat(p.unitPrice) * l.quantity;
  }, 0);

  const balance = await getMemberBalance(member.memberId);
  const afterBalance = balance - total;

  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: email,
    action: "saveMyOrder",
    entityType: "order",
    entityId: cycleId,
    payloadJson: JSON.stringify({ lineCount: newLines.length, total: total.toFixed(2) }),
    createdAt: now,
  });

  return {
    success: true,
    balanceWarning:
      afterBalance < 0 ? t.order.balanceWarning(formatMoney(Math.abs(afterBalance))) : null,
  };
}

// Loads the member's most recent past order and maps its products to the
// current cycle's products (matched by name/variant/format/unit). Used by
// the order form's "Riproponi ultimo ordine" button.
export async function loadLastOrderForPrefill(
  cycleId: string,
): Promise<{ cycleTitle: string; quantities: Record<string, number>; matched: number }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const member = await getMemberByEmail(email);
  if (!member) throw new Error(t.errors.memberNotFound);
  if (!member.active) throw new Error(t.errors.accountInactive);

  const result = await getLastMemberOrderForPrefill(member.memberId, cycleId);
  return { ...result, matched: Object.keys(result.quantities).length };
}
