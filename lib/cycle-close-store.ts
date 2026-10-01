// The database side of closing a cycle (lib/cycle-close.ts has the rules):
// the status flip and every charge in one guarded db.batch, then the
// notifications. Out of the "use server" module so the integration tests can
// run it; lib/actions/admin.ts calls it after requireAdmin().

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { ActionError } from "@/lib/action-error";
import { buildCycleCloseCharges, ordersSnapshot } from "@/lib/cycle-close";
import { liveLedger } from "@/lib/db/ledger-live";
import { ledgerEntries, orderCycles, orderDrafts, orders } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatHandlingFee, formatMoney } from "@/lib/i18n/format";
import { dispatchWithBodies, getMemberEmails } from "@/lib/notifications/dispatch";
import { genId, type Db } from "@/lib/payments/effects";
import { cycleHandlingFee, sameHandlingFee, type HandlingFee } from "@/lib/payments/order-payment";

const CLOSE_ATTEMPTS = 3;

// The guard of the close batch, run after the cycle's row lock in a fresh
// statement snapshot: the cycle must still be open, with exactly the orders
// and the fee the charges were computed from. Otherwise 1/0 aborts the whole
// batch (22012).
export function closeGuardSql(
  cycleId: string,
  snapshot: string,
  fee: { type: string | null; value: string | null },
): SQL {
  return sql`SELECT 1 / (CASE WHEN
      (SELECT status FROM order_cycles WHERE cycle_id = ${cycleId}) = 'open'
      AND (SELECT handling_fee_type IS NOT DISTINCT FROM ${fee.type}::text
                  AND handling_fee_value IS NOT DISTINCT FROM ${fee.value}::numeric
           FROM order_cycles WHERE cycle_id = ${cycleId})
      AND (SELECT coalesce(jsonb_object_agg(g.member_id, g.total::text), '{}'::jsonb)
           FROM (SELECT member_id, sum(line_total) AS total FROM orders
                 WHERE cycle_id = ${cycleId} GROUP BY member_id) g)
          = ${snapshot}::jsonb
    THEN 1 ELSE 0 END) AS close_guard`;
}

// Status flip, every order_charge, shipping_charge and handling_charge are
// committed together in a single db.batch (one Neon transaction), so a
// failure can no longer leave a cycle reopened with charges already posted.
// Notifications go out after the commit, best-effort. Callers are
// responsible for requireAdmin(), audit log, and revalidation.
export async function performCycleClose(
  db: Db,
  cycleId: string,
  adminEmail: string,
): Promise<{ chargesGenerated: number }> {
  for (let attempt = 1; attempt <= CLOSE_ATTEMPTS; attempt++) {
    const [cycle] = await db
      .select({
        status: orderCycles.status,
        title: orderCycles.title,
        shippingMode: orderCycles.shippingMode,
        shippingCostPerMember: orderCycles.shippingCostPerMember,
        shippingTotal: orderCycles.shippingTotal,
        paymentMode: orderCycles.paymentMode,
        handlingFeeType: orderCycles.handlingFeeType, // B3
        handlingFeeValue: orderCycles.handlingFeeValue, // B3
      })
      .from(orderCycles)
      .where(eq(orderCycles.cycleId, cycleId))
      .limit(1);
    if (!cycle) throw new ActionError(t.errors.cycleNotFound);
    if (cycle.status !== "open") throw new ActionError(t.errors.cycleNotFoundOrAlreadyClosed);
    const fee = cycleHandlingFee(cycle); // B3

    const memberTotals = await db
      .select({
        memberId: orders.memberId,
        total: sql<string>`sum(${orders.lineTotal})`,
      })
      .from(orders)
      .where(eq(orders.cycleId, cycleId))
      .groupBy(orders.memberId);

    // A cycle closed by the pre-atomic code could have been reopened with
    // some charges already posted: never charge those members twice.
    const existingCharges = await db
      .select({ memberId: ledgerEntries.memberId, type: ledgerEntries.type })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.cycleId, cycleId),
          inArray(ledgerEntries.type, ["order_charge", "shipping_charge", "handling_charge"]), // B3
          liveLedger,
        ),
      );
    const chargedWith = (type: string) =>
      new Set(existingCharges.filter((c) => c.type === type).map((c) => c.memberId));

    const charges = buildCycleCloseCharges(memberTotals, cycle, {
      fee,
      alreadyCharged: {
        order: chargedWith("order_charge"),
        shipping: chargedWith("shipping_charge"),
        handling: chargedWith("handling_charge"),
      },
    });
    const now = new Date();

    // 1. Row-lock the cycle: saveOrder takes the same lock first in its own
    //    batch (saveOrderDraft a shared one), so from here on no member write
    //    can commit on this cycle.
    // 2. Guard (closeGuardSql): still open, same orders, same fee.
    // 3. Flip the status, drop the cycle's order drafts (they never become
    //    orders) and post every charge in the same transaction.
    const lockCycle = db.execute(sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`);
    const guard = db.execute(
      closeGuardSql(cycleId, ordersSnapshot(memberTotals), {
        type: cycle.handlingFeeType,
        value: cycle.handlingFeeValue,
      }),
    );
    const flipStatus = db
      .update(orderCycles)
      .set({ status: "closed", closedAt: now })
      .where(and(eq(orderCycles.cycleId, cycleId), eq(orderCycles.status, "open")));
    const deleteDrafts = db.delete(orderDrafts).where(eq(orderDrafts.cycleId, cycleId));
    const statements: BatchItem<"pg">[] = [lockCycle, guard, flipStatus, deleteDrafts];
    const chargeRows = (rows: Array<{ memberId: string; amount: string }>, type: string, note: string) =>
      rows.map((c) => ({
        entryId: genId("led"),
        memberId: c.memberId,
        entryDate: now,
        type,
        amount: c.amount,
        cycleId,
        note,
        createdBy: adminEmail,
        createdAt: now,
      }));
    if (charges.orderCharges.length > 0) {
      statements.push(db.insert(ledgerEntries).values(chargeRows(charges.orderCharges, "order_charge", t.ledger.orderCharge)));
    }
    if (charges.shippingCharges.length > 0) {
      const note = cycle.shippingMode === "proportional" ? "Spedizione (quota proporzionale)" : "Spedizione";
      statements.push(db.insert(ledgerEntries).values(chargeRows(charges.shippingCharges, "shipping_charge", note)));
    }
    // B3: same batch, same instant as order_charge (lib/invariants.ts pairs
    // them by created_at).
    if (charges.handlingCharges.length > 0 && fee) {
      const note = `${t.ledger.handlingCharge} (${formatHandlingFee(fee)})`;
      statements.push(db.insert(ledgerEntries).values(chargeRows(charges.handlingCharges, "handling_charge", note)));
    }

    try {
      await db.batch(statements as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
    } catch (e) {
      // 22012 = division_by_zero, i.e. the guard fired: the cycle is no
      // longer open (concurrent close), or an order or the fee changed under us.
      if (!(e instanceof Error && /22012|division by zero/i.test(e.message))) throw e;
      const [current] = await db
        .select({ status: orderCycles.status })
        .from(orderCycles)
        .where(eq(orderCycles.cycleId, cycleId))
        .limit(1);
      if (current?.status !== "open") throw new ActionError(t.errors.cycleNotFoundOrAlreadyClosed);
      continue; // orders or fee changed: recompute from fresh data
    }

    // Committed. One notification per charged member. A delivery failure is
    // logged, never rolled back onto the (already committed) close.
    try {
      const emailByMember = await getMemberEmails(
        db,
        charges.summaries.map((s) => s.memberId),
      );
      const items = charges.summaries.map((s) => {
        const total = formatMoney(s.orderTotal + s.shippingShare + s.handlingShare);
        const shipping = s.shippingShare > 0 ? formatMoney(s.shippingShare) : null;
        // Pay-per-order: the charge is provisional until the weighing and the
        // supplier's sheet, then settled.
        const body =
          cycle.paymentMode === "per_order"
            ? t.notificationsServer.orderClosedPerOrderBody(cycle.title, total)
            : s.handlingShare > 0
              ? t.notificationsServer.orderClosedBodyWithFee(
                  cycle.title,
                  total,
                  formatMoney(s.orderTotal),
                  shipping,
                  formatMoney(s.handlingShare),
                )
              : shipping
                ? t.notificationsServer.orderClosedBodyWithShipping(cycle.title, total, formatMoney(s.orderTotal), shipping)
                : t.notificationsServer.orderClosedBody(cycle.title, formatMoney(s.orderTotal));
        return {
          memberId: s.memberId,
          email: emailByMember.get(s.memberId) ?? null,
          title: t.notificationsServer.orderClosedTitle,
          body,
          href: `/storico?cycleId=${cycleId}`,
        };
      });
      if (items.length > 0) await dispatchWithBodies(db, items, "order_closed", now);
    } catch (notifyError) {
      console.error("[order_closed] dispatch failed:", notifyError);
    }

    return { chargesGenerated: charges.orderCharges.length };
  }
  throw new ActionError(t.errors.cycleCloseOrdersChanged);
}

// Sets the fee of a cycle that is still open; false when it no longer is.
// One conditional statement, so a close that commits first always wins
// (drizzle/0026 refuses the change in the database too).
export async function setOpenCycleFee(db: Db, cycleId: string, fee: HandlingFee | null): Promise<boolean> {
  const rows = await db
    .update(orderCycles)
    .set({ handlingFeeType: fee?.type ?? null, handlingFeeValue: fee ? fee.value.toFixed(2) : null })
    .where(and(eq(orderCycles.cycleId, cycleId), eq(orderCycles.status, "open")))
    .returning({ cycleId: orderCycles.cycleId });
  return rows.length > 0;
}

// Saves the fee a cycle form sent: changed while the cycle is open, and
// accepted untouched on a closed one. A form opened before the close and
// saved after it (to fix a title, say) still carries the fee it was loaded
// with: that is not an attempt to change what members were charged. False
// when the cycle is closed (or gone) and the fee differs.
export async function updateCycleFee(db: Db, cycleId: string, fee: HandlingFee | null): Promise<boolean> {
  if (await setOpenCycleFee(db, cycleId, fee)) return true;
  const [current] = await db
    .select({ type: orderCycles.handlingFeeType, value: orderCycles.handlingFeeValue })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!current) return false;
  return sameHandlingFee(cycleHandlingFee({ handlingFeeType: current.type, handlingFeeValue: current.value }), fee);
}
