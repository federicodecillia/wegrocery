"use server";

import { revalidatePath } from "next/cache";
import { eq, and, ne, sql, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { formatMoney, formatDate, formatDateTime } from "@/lib/i18n/format";
import { parseCycleDates } from "@/lib/cycle-dates";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { auditLog, ledgerEntries, members, orderCycles, orders, payments, products, suppliers, supplierProducts } from "@/lib/db/schema";
import { upsertCycleProducts } from "@/lib/db/cycle-products";
import { isUniqueViolation } from "@/lib/db/errors";
import { getMembersByEmails } from "@/lib/db/queries";
import { findEmailConflict, normalizeEmail } from "@/lib/member-email";
import type { BatchItem } from "drizzle-orm/batch";
import { orderLinesSnapshot, planClosedOrderEdit } from "@/lib/closed-order-edit";
import { buildCycleCloseCharges, ordersSnapshot } from "@/lib/cycle-close";
import {
  normalizeShippingMode,
  planShippingRecompute,
  resolveShippingUpdate,
  shippingRowsSnapshot,
  type ShippingConfig,
  type ShippingMode,
  type ShippingRecomputePlan,
} from "@/lib/shipping";
import {
  EXTERNAL_REF_MAX_LENGTH,
  EXTERNAL_REF_UNIQUE_INDEX,
  duplicateWindow,
  findPossibleDuplicate,
  isAdminEditableLedgerType,
  isOutgoingLedgerType,
  planManualMovement,
  validateLedgerEntryEdit,
  validatePayoutAmount,
  type LedgerAmountError,
  type ManualMovementError,
  type ManualMovementInput,
  type ManualMovementPlan,
} from "@/lib/ledger";
import {
  dispatchNotification,
  dispatchToMembers,
  dispatchWithBodies,
  getMemberEmails,
  getResolvedPreferences,
} from "@/lib/notifications/dispatch";
import { selectCycleAccessMembers } from "@/lib/notifications/reminder";
import { DEFAULT_ACCESS_LEVEL, normalizeAccessLevel, normalizeRole, type AccessLevel } from "@/lib/roles";

function ledgerAmountErrorMessage(code: LedgerAmountError): string {
  switch (code) {
    case "notEditable":
      return t.errors.ledgerEntryNotEditable;
    case "notFinite":
      return t.errors.amountInvalid;
    case "zero":
      return t.errors.amountZero;
    case "signChange":
      return t.errors.amountSignChange;
    case "notPositive":
      return t.errors.amountMustBePositive;
  }
}

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

async function writeAudit(
  db: ReturnType<typeof getDb>,
  userEmail: string,
  action: string,
  entityType: string,
  entityId: string,
  payload?: unknown,
) {
  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail,
    action,
    entityType,
    entityId,
    payloadJson: payload != null ? JSON.stringify(payload) : null,
    createdAt: new Date(),
  });
}

// ── Ciclo ─────────────────────────────────────────────────────────────────────

// ShippingMode is not re-exported from here on purpose: this is a "use server"
// module, and a type-only export leaves nothing behind at runtime for the
// actions manifest to point at. Next 15 tolerates it; Next 16's Turbopack build
// fails with "Export ShippingMode doesn't exist in target module". Import the
// type from @/lib/shipping, which is where it is declared.

// Date fields are datetime-local wall-clock strings ("YYYY-MM-DDTHH:mm") in
// APP_TIME_ZONE; the actions convert them with parseCycleDates.
export type CreateCycleInput = {
  title: string;
  pickupDate: string;
  pickupEndTime: string;
  pickup2Date: string;
  pickup2EndTime: string;
  orderCloseAt: string;
  supplierId?: string;
  /** An AccessLevel; legacy values are normalized, unknown ones rejected. Empty = default. */
  accessLevel: string;
  notes: string;
  shippingMode: ShippingMode;
  shippingCostPerMember: string;
  shippingTotal: string;
};

export async function adminCreateCycle(data: CreateCycleInput): Promise<{error?: string}> {
  try {
    const admin = await requireAdmin();
    if (!data.title?.trim()) return { error: t.errors.fieldRequired(t.fields.title) };
    const dates = parseCycleDates({
      orderCloseAt: data.orderCloseAt ?? "",
      pickupDate: data.pickupDate ?? "",
      pickup2Date: data.pickup2Date ?? "",
    });
    if ("error" in dates) return { error: dates.error };
    const orderCloseAt = dates.orderCloseAt!;
    if (!data.supplierId) return { error: t.errors.fieldRequired(t.fields.supplier) };
    const accessLevel = data.accessLevel ? normalizeAccessLevel(data.accessLevel) : DEFAULT_ACCESS_LEVEL;
    if (!accessLevel) return { error: t.errors.invalidAccessLevel };

    const db = getDb();

    const cycleId = genId("cyc");
    const now = new Date();
    // "manual" is reserved for the distinta import; a new cycle starts fixed.
    const requestedMode = normalizeShippingMode(data.shippingMode);
    const shippingMode = requestedMode === "manual" ? "fixed_per_member" : requestedMode;
    await db.insert(orderCycles).values({
      cycleId,
      title: data.title.trim(),
      pickupDate: dates.pickupDate,
      pickupEndTime: data.pickupEndTime || null,
      pickup2Date: dates.pickup2Date,
      pickup2EndTime: data.pickup2EndTime || null,
      shippingMode,
      shippingCostPerMember:
        shippingMode === "fixed_per_member" && data.shippingCostPerMember
          ? data.shippingCostPerMember
          : null,
      shippingTotal:
        shippingMode === "proportional" && data.shippingTotal ? data.shippingTotal : null,
      orderOpenAt: now,
      orderCloseAt,
      status: "open",
      accessLevel,
      notes: data.notes?.trim() || null,
      createdBy: admin.email,
      createdAt: now,
      supplierId: data.supplierId || null,
    });

    await writeAudit(db, admin.email, "create_cycle", "cycle", cycleId, { ...data, accessLevel });

    // Notify members who can see this cycle that it's open. Cycles are always
    // created already-open (no scheduled opens), so this is the single emit
    // point for cycle_opened. Kept independent of cycle creation: a delivery
    // failure must not report the (already committed) cycle as failed.
    try {
      const allMembers = await db
        .select({
          memberId: members.memberId,
          email: members.email,
          role: members.role,
          active: members.active,
        })
        .from(members);
      const recipients = selectCycleAccessMembers(allMembers, accessLevel);
      await dispatchToMembers(
        db,
        recipients.map((m) => ({ memberId: m.memberId, email: m.email })),
        {
          type: "cycle_opened",
          title: t.notificationsServer.cycleOpenedTitle,
          body: t.notificationsServer.cycleOpenedBody(
            data.title.trim(),
            formatDateTime(orderCloseAt),
          ),
          href: "/ordine",
        },
        now,
      );
    } catch (notifyError) {
      console.error("[cycle_opened] dispatch failed:", notifyError);
    }

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/notifiche");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.cycleCreationError };
  }
}

// Internal: performs the actual close-cycle work. Status flip, every
// order_charge and every shipping_charge are committed together in a single
// db.batch (one Neon transaction), so a failure can no longer leave a cycle
// reopened with charges already posted. Notifications go out after the
// commit, best-effort. Returns chargesGenerated.
// Callers are responsible for requireAdmin(), audit log, and revalidation.
const CLOSE_ATTEMPTS = 3;

async function performCycleClose(
  db: ReturnType<typeof getDb>,
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
      })
      .from(orderCycles)
      .where(eq(orderCycles.cycleId, cycleId))
      .limit(1);
    if (!cycle) throw new Error(t.errors.cycleNotFound);
    if (cycle.status !== "open") throw new Error(t.errors.cycleNotFoundOrAlreadyClosed);

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
          inArray(ledgerEntries.type, ["order_charge", "shipping_charge"]),
        ),
      );
    const alreadyCharged = {
      order: new Set(existingCharges.filter((c) => c.type === "order_charge").map((c) => c.memberId)),
      shipping: new Set(
        existingCharges.filter((c) => c.type === "shipping_charge").map((c) => c.memberId),
      ),
    };

    const charges = buildCycleCloseCharges(memberTotals, cycle, alreadyCharged);
    const now = new Date();

    // 1. Row-lock the cycle: saveOrder takes the same lock first in its own
    //    batch, so from here on no member write can commit on this cycle.
    // 2. Guard, in a fresh statement snapshot taken after the lock: the cycle
    //    must still be open and the orders must be exactly the ones the
    //    charges were computed from. Otherwise 1/0 aborts the whole batch.
    // 3. Flip the status and post every charge in the same transaction.
    const lockCycle = db.execute(
      sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`,
    );
    const guard = db.execute(
      sql`SELECT 1 / (CASE WHEN
            (SELECT status FROM order_cycles WHERE cycle_id = ${cycleId}) = 'open'
            AND (SELECT coalesce(jsonb_object_agg(g.member_id, g.total::text), '{}'::jsonb)
                 FROM (SELECT member_id, sum(line_total) AS total FROM orders
                       WHERE cycle_id = ${cycleId} GROUP BY member_id) g)
                = ${ordersSnapshot(memberTotals)}::jsonb
          THEN 1 ELSE 0 END) AS close_guard`,
    );
    const flipStatus = db
      .update(orderCycles)
      .set({ status: "closed", closedAt: now })
      .where(and(eq(orderCycles.cycleId, cycleId), eq(orderCycles.status, "open")));
    const statements: BatchItem<"pg">[] = [lockCycle, guard, flipStatus];
    if (charges.orderCharges.length > 0) {
      statements.push(
        db.insert(ledgerEntries).values(
          charges.orderCharges.map((c) => ({
            entryId: genId("led"),
            memberId: c.memberId,
            entryDate: now,
            type: "order_charge",
            amount: c.amount,
            cycleId,
            note: t.ledger.orderCharge,
            createdBy: adminEmail,
            createdAt: now,
          })),
        ),
      );
    }
    if (charges.shippingCharges.length > 0) {
      statements.push(
        db.insert(ledgerEntries).values(
          charges.shippingCharges.map((c) => ({
            entryId: genId("led"),
            memberId: c.memberId,
            entryDate: now,
            type: "shipping_charge",
            amount: c.amount,
            cycleId,
            note:
              cycle.shippingMode === "proportional"
                ? "Spedizione (quota proporzionale)"
                : "Spedizione",
            createdBy: adminEmail,
            createdAt: now,
          })),
        ),
      );
    }

    try {
      await db.batch(statements as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
    } catch (e) {
      // 22012 = division_by_zero, i.e. the guard fired: either the cycle is
      // no longer open (concurrent close) or an order changed under us.
      if (!(e instanceof Error && /22012|division by zero/i.test(e.message))) throw e;
      const [current] = await db
        .select({ status: orderCycles.status })
        .from(orderCycles)
        .where(eq(orderCycles.cycleId, cycleId))
        .limit(1);
      if (current?.status !== "open") throw new Error(t.errors.cycleNotFoundOrAlreadyClosed);
      continue; // orders changed: recompute from fresh totals
    }

    // Committed. One notification per charged member; bodies differ per
    // member (order + optional shipping). A delivery failure is logged, never
    // rolled back onto the (already committed) close.
    try {
      const emailByMember = await getMemberEmails(
        db,
        charges.summaries.map((s) => s.memberId),
      );
      const items = charges.summaries.map((s) => {
        const body =
          s.shippingShare > 0
            ? t.notificationsServer.orderClosedBodyWithShipping(
                cycle.title,
                formatMoney(s.orderTotal + s.shippingShare),
                formatMoney(s.orderTotal),
                formatMoney(s.shippingShare),
              )
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
  throw new Error(t.errors.cycleCloseOrdersChanged);
}

export async function adminCloseCycle(cycleId: string) {
  const admin = await requireAdmin();
  const db = getDb();
  const result = await performCycleClose(db, cycleId, admin.email);
  await writeAudit(db, admin.email, "close_cycle", "cycle", cycleId, result);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/storico");
  return result;
}

// Cancels an already-closed cycle (e.g. the supplier failed to deliver) and
// refunds every affected member. The refund is computed from each member's
// CURRENT net ledger balance for this cycle — order_charge + shipping_charge
// + any later correction — not just the original charge, so it stays exact
// even if the order was already partially corrected via adminEditClosedOrder
// before the cancel. Shipping can be excluded from the refund when the co-op
// already paid the courier regardless of the failed delivery.
export async function adminCancelClosedCycle(
  cycleId: string,
  input: { refundShipping: boolean; reason: string },
): Promise<{ refundedMembers: number; totalRefunded: number }> {
  const admin = await requireAdmin();
  const db = getDb();
  const now = new Date();

  const reason = input.reason.trim();
  if (!reason) throw new Error(t.errors.cancelReasonRequired);

  const [cycle] = await db
    .select({ status: orderCycles.status, title: orderCycles.title })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!cycle) throw new Error(t.errors.cycleNotFound);
  if (cycle.status !== "closed") throw new Error(t.errors.cycleNotClosed);

  // Atomic compare-and-swap, same guard as performCycleClose: only the
  // caller that flips closed→cancelled proceeds. A concurrent second call
  // gets 0 rows back and fails cleanly instead of double-refunding.
  const cancelledRows = await db
    .update(orderCycles)
    .set({ status: "cancelled" })
    .where(and(eq(orderCycles.cycleId, cycleId), eq(orderCycles.status, "closed")))
    .returning({ cycleId: orderCycles.cycleId });
  if (cancelledRows.length === 0) throw new Error(t.errors.cycleNotClosed);

  let refundedMembers = 0;
  let totalRefunded = 0;

  try {
    const netByMember = await db
      .select({ memberId: ledgerEntries.memberId, net: sql<string>`sum(${ledgerEntries.amount})` })
      .from(ledgerEntries)
      .where(
        input.refundShipping
          ? eq(ledgerEntries.cycleId, cycleId)
          : and(eq(ledgerEntries.cycleId, cycleId), ne(ledgerEntries.type, "shipping_charge")),
      )
      .groupBy(ledgerEntries.memberId);

    const toRefund = netByMember
      .map((r) => ({ memberId: r.memberId, net: parseFloat(r.net) }))
      .filter((r) => Math.abs(r.net) > 0.005);

    if (toRefund.length > 0) {
      await db.insert(ledgerEntries).values(
        toRefund.map((r) => ({
          entryId: genId("led"),
          memberId: r.memberId,
          entryDate: now,
          type: "correction",
          amount: (-r.net).toFixed(2),
          cycleId,
          note: `${t.ledger.cycleCancelled} — ${reason}`,
          createdBy: admin.email,
          createdAt: now,
        })),
      );

      const emailByMember = await getMemberEmails(
        db,
        toRefund.map((r) => r.memberId),
      );
      await dispatchWithBodies(
        db,
        toRefund.map((r) => ({
          memberId: r.memberId,
          email: emailByMember.get(r.memberId) ?? null,
          title: t.notificationsServer.cycleCancelledTitle,
          body: t.notificationsServer.cycleCancelledBody(cycle.title, formatMoney(-r.net), reason),
          href: `/storico?cycleId=${cycleId}`,
        })),
        "cycle_cancelled",
        now,
      );

      refundedMembers = toRefund.length;
      totalRefunded = toRefund.reduce((sum, r) => sum + -r.net, 0);
    }
  } catch (e) {
    // Roll back the status flip so the admin can retry instead of leaving
    // the cycle cancelled with a partial or missing refund.
    await db.update(orderCycles).set({ status: "closed" }).where(eq(orderCycles.cycleId, cycleId));
    throw e;
  }

  await writeAudit(db, admin.email, "cancel_cycle", "cycle", cycleId, {
    reason,
    refundShipping: input.refundShipping,
    refundedMembers,
    totalRefunded: totalRefunded.toFixed(2),
  });

  revalidatePath("/admin");
  revalidatePath("/storico");
  revalidatePath("/notifiche");
  revalidatePath("/");

  return { refundedMembers, totalRefunded };
}

// Applies per-product price adjustments (typically because the actual weight
// of weight-based items differs from the ordered quantity, e.g. 1 kg of
// salad weighed at 1.2 kg) and then closes the cycle in a single call.
//
// For each adjustment we update both products.unitPrice (so future reads of
// the cycle show the corrected price) and orders.unit_price_snapshot +
// orders.line_total (so the ledger entries generated by performCycleClose
// reflect the corrected amounts).
export async function adminCloseCycleWithAdjustments(
  cycleId: string,
  adjustments: ReadonlyArray<{ productId: string; finalUnitPrice: number }>,
): Promise<{ chargesGenerated: number; productsAdjusted: number }> {
  const admin = await requireAdmin();
  const db = getDb();

  // Re-pricing rewrites products and order lines, so it must never run on a
  // cycle that is already closed (or cancelled): check before touching rows.
  const [current] = await db
    .select({ status: orderCycles.status })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!current) throw new Error(t.errors.cycleNotFound);
  if (current.status !== "open") throw new Error(t.errors.cycleNotFoundOrAlreadyClosed);

  // Validate up-front: reject empty IDs, negative prices, and adjustments
  // that name a product not belonging to this cycle. Better to fail before
  // we touch any rows than mid-way through.
  const cleaned = adjustments
    .filter((a) => a.productId && Number.isFinite(a.finalUnitPrice) && a.finalUnitPrice >= 0)
    .map((a) => ({ productId: a.productId, finalUnitPrice: a.finalUnitPrice }));

  if (cleaned.length > 0) {
    const productIds = cleaned.map((a) => a.productId);
    const cycleProducts = await db
      .select({ productId: products.productId })
      .from(products)
      .where(and(eq(products.cycleId, cycleId), inArray(products.productId, productIds)));
    const validIds = new Set(cycleProducts.map((p) => p.productId));
    const orphan = cleaned.find((a) => !validIds.has(a.productId));
    if (orphan) throw new Error(`Prodotto non appartenente al ciclo: ${orphan.productId}`);
  }

  // Apply the price adjustments before closing. We do not use a transaction
  // (neon-http does not support interactive ones), but performCycleClose
  // charges from the order totals it re-checks inside its own batch, so the
  // charges always match the re-priced lines, and only one caller can close.
  for (const adj of cleaned) {
    const priceStr = adj.finalUnitPrice.toFixed(2);
    await db
      .update(products)
      .set({ unitPrice: priceStr })
      .where(eq(products.productId, adj.productId));
    // Recompute lineTotal from quantity * adjusted price for every order
    // line that references this product in this cycle.
    await db
      .update(orders)
      .set({
        unitPriceSnapshot: priceStr,
        lineTotal: sql`${orders.quantity}::numeric * ${priceStr}::numeric`,
      })
      .where(and(eq(orders.productId, adj.productId), eq(orders.cycleId, cycleId)));
  }

  const result = await performCycleClose(db, cycleId, admin.email);

  await writeAudit(db, admin.email, "close_cycle_with_adjustments", "cycle", cycleId, {
    ...result,
    productsAdjusted: cleaned.length,
    adjustments: cleaned,
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/storico");
  revalidatePath("/ordine");
  return { ...result, productsAdjusted: cleaned.length };
}

// Reads and plans a closed cycle's shipping recompute (planShippingRecompute:
// shares on the members' EFFECTIVE totals, after weighing). Returns the ledger
// statements that apply the plan and a SQL condition that holds while nothing
// the plan was computed from has changed: cycle still closed with the same
// shipping settings, same effective totals, same shipping rows. The caller
// runs both in one db.batch after locking the cycle row FOR UPDATE, so two
// recomputes (or an edit and a recompute) cannot interleave their writes.
// `projected` stands in for one member's total as a pending edit will leave
// it: adminEditClosedOrder plans before its batch has changed the lines.
async function prepareShippingRecompute(
  db: ReturnType<typeof getDb>,
  cycleId: string,
  cycle: ShippingConfig,
  adminEmail: string,
  now: Date,
  projected?: { memberId: string; total: string },
) {
  const [totals, rows] = await Promise.all([
    db
      .select({
        memberId: orders.memberId,
        total: sql<string>`sum(coalesce(${orders.actualLineTotal}, ${orders.lineTotal}))`,
      })
      .from(orders)
      .where(eq(orders.cycleId, cycleId))
      .groupBy(orders.memberId),
    db
      .select({
        entryId: ledgerEntries.entryId,
        memberId: ledgerEntries.memberId,
        amount: ledgerEntries.amount,
      })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.cycleId, cycleId), eq(ledgerEntries.type, "shipping_charge"))),
  ]);
  const plan = planShippingRecompute(
    cycle,
    projected ? [...totals.filter((r) => r.memberId !== projected.memberId), projected] : totals,
    rows,
  );

  // Rows are rewritten in place, never deleted, so the audit trail stays.
  const statements: BatchItem<"pg">[] = [];
  for (const u of plan.updates) {
    statements.push(
      db
        .update(ledgerEntries)
        .set({ amount: u.amount, note: t.ledger.shippingAdjusted, updatedAt: now, updatedBy: adminEmail })
        .where(eq(ledgerEntries.entryId, u.entryId)),
    );
  }
  if (plan.inserts.length > 0) {
    statements.push(
      db.insert(ledgerEntries).values(
        plan.inserts.map((i) => ({
          entryId: genId("led"),
          memberId: i.memberId,
          entryDate: now,
          type: "shipping_charge",
          amount: i.amount,
          cycleId,
          note: t.ledger.shippingAdjusted,
          createdBy: adminEmail,
          createdAt: now,
        })),
      ),
    );
  }

  const settings = ["closed", cycle.shippingMode, cycle.shippingCostPerMember, cycle.shippingTotal];
  const guard = sql`(SELECT jsonb_build_array(status, shipping_mode,
                            shipping_cost_per_member::text, shipping_total::text)
                     FROM order_cycles WHERE cycle_id = ${cycleId})
                    = ${JSON.stringify(settings)}::jsonb
                AND (SELECT coalesce(jsonb_object_agg(g.member_id, g.total::text), '{}'::jsonb)
                     FROM (SELECT member_id, sum(coalesce(actual_line_total, line_total)) AS total
                           FROM orders WHERE cycle_id = ${cycleId} GROUP BY member_id) g)
                    = ${ordersSnapshot(totals)}::jsonb
                AND (SELECT coalesce(jsonb_object_agg(entry_id, amount::text), '{}'::jsonb)
                     FROM ledger_entries
                     WHERE cycle_id = ${cycleId} AND type = 'shipping_charge')
                    = ${shippingRowsSnapshot(rows)}::jsonb`;

  return { plan, statements, guard };
}

// One `order_adjusted` notification per member whose shipping share moved.
// Best-effort, after the commit: a failure is logged, never rolled back onto
// the ledger writes.
async function notifyShippingChanges(
  db: ReturnType<typeof getDb>,
  cycleId: string,
  cycleTitle: string,
  changes: ShippingRecomputePlan["changes"],
  now: Date,
): Promise<void> {
  if (changes.length === 0) return;
  try {
    const emailByMember = await getMemberEmails(
      db,
      changes.map((c) => c.memberId),
    );
    const items = changes.map((c) => ({
      memberId: c.memberId,
      email: emailByMember.get(c.memberId) ?? null,
      title: t.notificationsServer.shippingAdjustedTitle(cycleTitle),
      body: t.notificationsServer.shippingAdjustedBody(
        cycleTitle,
        formatMoney(c.oldShare),
        formatMoney(c.newShare),
      ),
      href: `/storico?cycleId=${cycleId}`,
    }));
    await dispatchWithBodies(db, items, "order_adjusted", now);
  } catch (notifyError) {
    console.error("[order_adjusted] shipping dispatch failed:", notifyError);
  }
}

// Re-splits a closed cycle's shipping_charge entries after its shipping
// settings changed (adminUpdateCycle); adminEditClosedOrder runs the same plan
// inside its own batch. Existing rows are updated in place, members with no
// row who now owe a share get one, a member left with no effective total is
// reversed to 0, and only members whose share moved are notified. A manual
// (distinta-imported) cycle is left alone. Returns those members' ids.
//
// The writes are one guarded batch, planned again from fresh state when a
// concurrent change trips the guard. adminUpdateCycle saves the new settings
// before calling this, so if it still fails the settings are saved and the
// rows keep the previous split: saving any member's order of the cycle again
// (Modifica in Recap ordini, even unchanged) re-runs the recompute and fixes
// them.
const SHIPPING_RECOMPUTE_ATTEMPTS = 3;

async function recomputeShippingForClosedCycle(
  db: ReturnType<typeof getDb>,
  cycleId: string,
  adminEmail: string,
): Promise<{ adjustedMembers: string[] }> {
  for (let attempt = 1; attempt <= SHIPPING_RECOMPUTE_ATTEMPTS; attempt++) {
    const [cycle] = await db
      .select({
        status: orderCycles.status,
        title: orderCycles.title,
        shippingMode: orderCycles.shippingMode,
        shippingCostPerMember: orderCycles.shippingCostPerMember,
        shippingTotal: orderCycles.shippingTotal,
      })
      .from(orderCycles)
      .where(eq(orderCycles.cycleId, cycleId))
      .limit(1);
    if (!cycle || cycle.status !== "closed" || cycle.shippingMode === "manual") {
      return { adjustedMembers: [] };
    }

    const now = new Date();
    const shipping = await prepareShippingRecompute(db, cycleId, cycle, adminEmail, now);
    if (shipping.statements.length === 0) return { adjustedMembers: [] };

    const lock = db.execute(sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`);
    const guard = db.execute(
      sql`SELECT 1 / (CASE WHEN ${shipping.guard} THEN 1 ELSE 0 END) AS shipping_guard`,
    );
    try {
      await db.batch([lock, guard, ...shipping.statements]);
    } catch (e) {
      // 22012 = division_by_zero, i.e. the guard fired: plan again.
      if (!(e instanceof Error && /22012|division by zero/i.test(e.message))) throw e;
      continue;
    }

    await notifyShippingChanges(db, cycleId, cycle.title, shipping.plan.changes, now);
    return { adjustedMembers: shipping.plan.changes.map((c) => c.memberId) };
  }
  throw new Error(t.errors.cycleUpdateError);
}

export async function adminUpdateCycle(
  cycleId: string,
  data: {
    title?: string;
    pickupDate?: string;
    pickupEndTime?: string;
    pickup2Date?: string;
    pickup2EndTime?: string;
    orderCloseAt?: string;
    notes?: string;
    supplierId?: string;
    accessLevel?: string;
    shippingMode?: string;
    shippingCostPerMember?: string;
    shippingTotal?: string;
  },
): Promise<{ error?: string; adjustedMembers?: number }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();

    // Load current state so we can decide afterwards whether the cycle is
    // closed and whether shipping-related fields were touched.
    const [before] = await db
      .select({
        status: orderCycles.status,
        orderCloseAt: orderCycles.orderCloseAt,
        shippingMode: orderCycles.shippingMode,
        shippingCostPerMember: orderCycles.shippingCostPerMember,
        shippingTotal: orderCycles.shippingTotal,
      })
      .from(orderCycles)
      .where(eq(orderCycles.cycleId, cycleId))
      .limit(1);
    if (!before) return { error: t.errors.cycleNotFound };

    const dates = parseCycleDates(data);
    if ("error" in dates) return { error: dates.error };

    let accessLevel: AccessLevel | undefined;
    if (typeof data.accessLevel === "string") {
      const parsed = normalizeAccessLevel(data.accessLevel);
      if (!parsed) return { error: t.errors.invalidAccessLevel };
      accessLevel = parsed;
    }

    const isClosed = before.status === "closed";

    // Shipping is recomputed on a closed cycle only when its effective
    // configuration really changes. A "manual" (distinta-imported) cycle is
    // never touched: saving it to fix a pickup date used to zero everyone's
    // shipping and notify every member. See resolveShippingUpdate.
    const { patch: shippingPatch, changed: shippingChanged } = resolveShippingUpdate(before, data);

    await db
      .update(orderCycles)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.pickupDate !== undefined && {
          pickupDate: dates.pickupDate,
        }),
        ...(data.pickupEndTime !== undefined && { pickupEndTime: data.pickupEndTime || null }),
        ...(data.pickup2Date !== undefined && {
          pickup2Date: dates.pickup2Date,
        }),
        ...(data.pickup2EndTime !== undefined && { pickup2EndTime: data.pickup2EndTime || null }),
        ...(data.orderCloseAt !== undefined && { orderCloseAt: dates.orderCloseAt }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId || null }),
        ...(accessLevel !== undefined && { accessLevel }),
        ...shippingPatch,
      })
      .where(eq(orderCycles.cycleId, cycleId));

    let adjustedMembers = 0;
    if (isClosed && shippingChanged) {
      const shippingBefore = {
        shippingMode: before.shippingMode,
        shippingCostPerMember: before.shippingCostPerMember,
        shippingTotal: before.shippingTotal,
      };
      const { adjustedMembers: m } = await recomputeShippingForClosedCycle(
        db,
        cycleId,
        admin.email,
      );
      adjustedMembers = m.length;
      await writeAudit(db, admin.email, "cycle_shipping_recomputed", "cycle", cycleId, {
        before: shippingBefore,
        after: { ...shippingBefore, ...shippingPatch },
        affectedMembers: m,
      });
      revalidatePath("/storico");
      revalidatePath("/notifiche");
    }

    await writeAudit(db, admin.email, "update_cycle", "cycle", cycleId, { ...data, ...(accessLevel && { accessLevel }) });
    revalidatePath("/admin");
    revalidatePath("/");
    return { adjustedMembers };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.cycleUpdateError };
  }
}

// ── Prodotti ──────────────────────────────────────────────────────────────────

export async function adminUpdateCycleProduct(
  productId: string,
  data: {
    name: string;
    variant?: string;
    format?: string;
    unit?: string;
    category?: string;
    unitPrice: number;
    pricePerKg?: number | null;
    notes?: string;
  }
): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const pricePerKg =
      data.pricePerKg != null && !Number.isNaN(data.pricePerKg)
        ? data.pricePerKg.toFixed(2)
        : null;
    await db
      .update(products)
      .set({
        name: data.name,
        variant: data.variant || null,
        format: data.format || null,
        unit: data.unit || null,
        category: data.category || null,
        unitPrice: data.unitPrice.toFixed(2),
        pricePerKg,
        notes: data.notes || null,
      })
      .where(eq(products.productId, productId));
      
    await writeAudit(db, admin.email, "update_cycle_product", "product", productId, data);
    revalidatePath("/admin");
    revalidatePath("/ordine");
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

// ── Cassa ─────────────────────────────────────────────────────────────────────

function manualMovementErrorMessage(code: ManualMovementError): string {
  const errors = t.admin.treasury.movementErrors;
  switch (code) {
    case "invalidType":
      return errors.invalidType;
    case "invalidMethod":
      return errors.invalidMethod;
    case "refTooLong":
      return errors.refTooLong(EXTERNAL_REF_MAX_LENGTH);
    case "noteRequired":
      return errors.noteRequired;
    case "invalidDate":
      return errors.invalidDate;
    default:
      return ledgerAmountErrorMessage(code);
  }
}

async function memberBalance(db: ReturnType<typeof getDb>, memberId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.memberId, memberId));
  return parseFloat(row?.total ?? "0");
}

// A readable refusal when `ref` is already on a ledger row, compared like the
// unique index (upper(trim())), or null when it is free.
async function externalRefTakenMessage(
  db: ReturnType<typeof getDb>,
  ref: string,
): Promise<string | null> {
  const [taken] = await db
    .select({ entryDate: ledgerEntries.entryDate, fullName: members.fullName })
    .from(ledgerEntries)
    .innerJoin(members, eq(ledgerEntries.memberId, members.memberId))
    .where(sql`upper(trim(${ledgerEntries.externalRef})) = upper(trim(${ref}))`)
    .limit(1);
  if (!taken) return null;
  return t.admin.treasury.movementErrors.refTakenBy(ref, taken.fullName, formatDate(taken.entryDate));
}

// The non-blocking warning for a movement that repeats one of the same type
// and amount near the same date (online top-ups included), or null.
async function possibleDuplicateWarning(
  db: ReturnType<typeof getDb>,
  memberId: string,
  plan: ManualMovementPlan,
): Promise<string | null> {
  const { from, to } = duplicateWindow(plan.entryDate);
  const rows = await db
    .select({ amount: ledgerEntries.amount, entryDate: ledgerEntries.entryDate })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.memberId, memberId),
        eq(ledgerEntries.type, plan.type),
        sql`${ledgerEntries.entryDate} BETWEEN ${from.toISOString()} AND ${to.toISOString()}`,
      ),
    );
  const duplicate = findPossibleDuplicate(rows, plan.amountCents, plan.entryDate);
  if (!duplicate) return null;
  return t.admin.treasury.possibleDuplicate(
    t.admin.treasury.duplicateSubjects[plan.type],
    formatMoney(plan.amountCents / 100),
    formatDate(duplicate.entryDate),
  );
}

// What the member reads about a manual movement. The notification types map
// to existing preference categories (lib/notifications/categories.ts).
function manualMovementNotification(
  plan: ManualMovementPlan,
  newBalance: number,
): { type: string; title: string; body: string } {
  const n = t.notificationsServer;
  const amount = formatMoney(plan.amountCents / 100);
  const balance = formatMoney(newBalance);
  // The causale closes a sentence in the body: drop a period the admin typed.
  const reason = (plan.note ?? "").replace(/[.\s]+$/, "");
  switch (plan.type) {
    case "topup":
      return { type: "topup_received", title: n.topupReceivedTitle, body: n.topupReceivedBody(amount, balance) };
    case "payout":
      return { type: "payout_sent", title: n.payoutSentTitle, body: n.payoutSentBody(amount, reason, balance) };
    case "manual_charge":
      return {
        type: "manual_charge_recorded",
        title: n.manualChargeTitle,
        body: n.manualChargeBody(amount, reason, balance),
      };
    case "membership_fee":
      return {
        type: "membership_fee_charged",
        title: n.membershipFeeTitle,
        body: n.membershipFeeBody(amount, reason, balance),
      };
  }
}

// Outcome of a Cassa form submit. `error`: refused, nothing written.
// `warning`: a similar movement exists, nothing written; submitting again
// with `confirmDuplicate` records it. Otherwise it was recorded for
// `memberName`.
export type CassaMovementResult = { error?: string; warning?: string; memberName?: string };

type ManualMovementRequest = ManualMovementInput & { memberId: string; confirmDuplicate?: boolean };

// Shared by the top-up and the outgoing-movement actions, after their
// requireAdmin(): validate, check the member (and, for a payout, the
// balance), refuse a known reference, warn about a likely duplicate, then
// write the row, notify the member and audit the full row.
async function recordManualMovement(
  admin: { email: string },
  input: ManualMovementRequest,
): Promise<CassaMovementResult> {
  const now = new Date();
  const planned = planManualMovement(input, now);
  if ("error" in planned) return { error: manualMovementErrorMessage(planned.error) };
  const { plan } = planned;

  const db = getDb();
  const [member] = await db
    .select({ memberId: members.memberId, email: members.email, fullName: members.fullName })
    .from(members)
    .where(eq(members.memberId, input.memberId))
    .limit(1);
  if (!member) return { error: t.errors.memberNotFound };

  if (plan.type === "payout") {
    const excess = validatePayoutAmount(plan.amountCents / 100, await memberBalance(db, member.memberId));
    if (excess) return { error: t.admin.treasury.movementErrors.payoutExceedsBalance(formatMoney(excess.limit)) };
  }
  if (plan.externalRef !== null) {
    const taken = await externalRefTakenMessage(db, plan.externalRef);
    if (taken) return { error: taken };
  }
  if (!input.confirmDuplicate) {
    const warning = await possibleDuplicateWarning(db, member.memberId, plan);
    if (warning) return { warning };
  }

  const entryId = genId("led");
  const row = {
    entryId,
    memberId: member.memberId,
    entryDate: plan.entryDate,
    type: plan.type,
    amount: plan.amount,
    cycleId: null,
    note: plan.note,
    method: plan.method,
    externalRef: plan.externalRef,
    createdBy: admin.email,
    createdAt: now,
  };
  try {
    await db.insert(ledgerEntries).values(row);
  } catch (e) {
    // Another admin recorded the same reference since the check above.
    if (plan.externalRef !== null && isUniqueViolation(e, EXTERNAL_REF_UNIQUE_INDEX)) {
      return {
        error:
          (await externalRefTakenMessage(db, plan.externalRef)) ??
          t.admin.treasury.movementErrors.refTaken(plan.externalRef),
      };
    }
    throw e;
  }

  const newBalance = await memberBalance(db, member.memberId);
  await dispatchNotification(db, {
    memberId: member.memberId,
    memberEmail: member.email,
    ...manualMovementNotification(plan, newBalance),
    href: "/storico",
    createdAt: now,
  });

  await writeAudit(db, admin.email, `record_${plan.type}`, "ledger", entryId, { before: null, after: row });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/storico");
  return { memberName: member.fullName };
}

export type ManualTopupInput = {
  memberId: string;
  // As typed, positive. Everything here is re-validated by planManualMovement.
  amount: number;
  method: string;
  externalRef?: string;
  note?: string;
  entryDate?: string;
  confirmDuplicate?: boolean;
};

export async function adminRecordTopup(input: ManualTopupInput): Promise<CassaMovementResult> {
  try {
    const admin = await requireAdmin();
    return await recordManualMovement(admin, { ...input, type: "topup" });
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

export type OutgoingMovementInput = {
  memberId: string;
  // "payout" | "manual_charge" | "membership_fee"; anything else is refused.
  type: string;
  // As typed, positive: the row is stored negative.
  amount: number;
  // The causale, required and shown to the member.
  note: string;
  // Payout only (optional); ignored for charges and fees.
  method?: string;
  externalRef?: string;
  entryDate?: string;
  confirmDuplicate?: boolean;
};

// Payout (balance returned to the member, never beyond the balance), manual
// charge or membership fee.
export async function adminRecordOutgoingMovement(
  input: OutgoingMovementInput,
): Promise<CassaMovementResult> {
  try {
    const admin = await requireAdmin();
    if (!isOutgoingLedgerType(input.type)) return { error: t.admin.treasury.movementErrors.invalidType };
    return await recordManualMovement(admin, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

// ── Supplier email ───────────────────────────────────────────────────────────

// Returns the defaults the supplier-email dialog needs to pre-fill its
// fields (To / From / CC / Subject). Used by the client before the admin
// hits "Invia ora" so they can review and tweak any field.
export async function adminGetSupplierEmailDefaults(cycleId: string): Promise<
  | {
      ok: true;
      to: string;
      from: string;
      cc: string[];
      subject: string;
      supplierName: string;
    }
  | { error: string }
> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const [cycle] = await db
      .select({
        cycleId: orderCycles.cycleId,
        title: orderCycles.title,
        status: orderCycles.status,
        supplierId: orderCycles.supplierId,
        supplierEmail: suppliers.email,
        supplierName: suppliers.name,
      })
      .from(orderCycles)
      .leftJoin(suppliers, eq(orderCycles.supplierId, suppliers.supplierId))
      .where(eq(orderCycles.cycleId, cycleId))
      .limit(1);
    if (!cycle) return { error: t.errors.cycleNotFound };
    if (cycle.status !== "closed") return { error: t.errors.cycleNotClosed };
    if (!cycle.supplierId || !cycle.supplierName)
      return { error: t.errors.cycleNoSupplier };
    // A missing supplier email is NOT an error: the admin can type the
    // recipient directly in the dialog. We just leave the `to` field empty
    // so they know what's missing.

    const { getMailFromDefault } = await import("@/lib/email/resend");
    const from = getMailFromDefault() ?? "";

    return {
      ok: true,
      to: cycle.supplierEmail ?? "",
      from,
      cc: Array.from(new Set([admin.email, ...(brand.archiveCcEmail ? [brand.archiveCcEmail] : [])])),
      subject: `Ordine ${brand.orgName} — ${cycle.title}`,
      supplierName: cycle.supplierName,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

// Sends the closed cycle's order summary as a CSV attachment to the
// configured supplier. The acting admin is CC'd so they always have a copy
// in their own mailbox. The CSV is aggregated per product (one row per SKU,
// summing quantities and amounts across every member's order). Fails fast if
// the cycle isn't closed, has no supplier, or the supplier has no email on
// file — Resend errors are surfaced verbatim.
//
// Each header field is independently overridable from the dialog. Missing
// overrides fall back to the same defaults exposed by
// adminGetSupplierEmailDefaults so the two stay in sync.
export async function adminSendSupplierEmail(
  cycleId: string,
  overrides?: { to?: string; from?: string; cc?: string[]; subject?: string },
): Promise<{ ok: true; recipient: string; rowCount: number } | { error: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();

    const [cycle] = await db
      .select({
        cycleId: orderCycles.cycleId,
        title: orderCycles.title,
        status: orderCycles.status,
        pickupDate: orderCycles.pickupDate,
        supplierId: orderCycles.supplierId,
        supplierEmail: suppliers.email,
        supplierName: suppliers.name,
      })
      .from(orderCycles)
      .leftJoin(suppliers, eq(orderCycles.supplierId, suppliers.supplierId))
      .where(eq(orderCycles.cycleId, cycleId))
      .limit(1);
    if (!cycle) return { error: t.errors.cycleNotFound };
    if (cycle.status !== "closed") return { error: t.errors.cycleNotClosed };
    if (!cycle.supplierId || !cycle.supplierName)
      return { error: t.errors.cycleNoSupplier };

    const to = overrides?.to?.trim() || cycle.supplierEmail || "";
    if (!to) return { error: t.errors.recipientMissing };

    const { buildSupplierDistinta } = await import("@/lib/csv/distinta-builder");
    let distinta: Awaited<ReturnType<typeof buildSupplierDistinta>>;
    try {
      distinta = await buildSupplierDistinta(cycleId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : t.errors.distintaBuildError };
    }

    const { supplierOrderEmail } = await import("@/lib/email/templates");
    const defaults = supplierOrderEmail({
      cycleTitle: cycle.title,
      pickupDate: cycle.pickupDate,
      grandTotal: distinta.grandTotal,
      productCount: distinta.productCount,
      memberCount: distinta.memberCount,
    });
    const subject = overrides?.subject?.trim() || defaults.subject;

    // Always keep the GAS shared archive in CC so the cooperative has a
    // long-term record of every outbound supplier email, independent of
    // which admin clicked the button. De-duplicate in case the acting
    // admin's email is the archive itself.
    const cc = overrides?.cc
      ? Array.from(new Set(overrides.cc.map((e) => e.trim()).filter(Boolean)))
      : Array.from(new Set([admin.email, ...(brand.archiveCcEmail ? [brand.archiveCcEmail] : [])]));

    const { sendMail } = await import("@/lib/email/resend");
    const result = await sendMail({
      to,
      cc,
      from: overrides?.from?.trim() || undefined,
      // Replies land with the acting admin even when `from` is a shared
      // no-reply archive address — also a deliverability signal to spam
      // filters (a real, reply-able sender behind the message).
      replyTo: admin.email,
      subject,
      text: defaults.text,
      html: defaults.html,
      attachments: [{ filename: distinta.filename, content: distinta.content }],
    });
    if ("error" in result) return { error: result.error };

    await writeAudit(db, admin.email, "supplier_email_sent", "cycle", cycleId, {
      supplierId: cycle.supplierId,
      recipient: to,
      cc,
      from: overrides?.from?.trim() || null,
      subject,
      filename: distinta.filename,
      productCount: distinta.productCount,
      memberCount: distinta.memberCount,
      grandTotal: distinta.grandTotal,
      messageId: result.id ?? null,
    });

    return { ok: true, recipient: to, rowCount: distinta.productCount };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.emailSendError };
  }
}

// ── Post-close per-line actuals ──────────────────────────────────────────────

// Records the *actually delivered* quantity and cost for a single order line
// of a closed cycle (e.g. ordered 1 kg of beetroot, received 800 g → effective
// €1.60 instead of €2.00). The original `quantity`/`lineTotal` columns stay
// frozen for history; the delta between the previous effective total and the
// new one is posted as a `correction` ledger entry, matching the model used
// by adminEditClosedOrder so the two flows compose cleanly.
//
// Passing both args as `null` resets the line back to "delivered as ordered"
// and reverses any previous correction by posting a fresh delta in the
// opposite direction.
export async function adminUpdateOrderLineActuals(input: {
  orderLineId: string;
  actualQuantity: string | null;
  actualLineTotal: string | null;
}): Promise<
  | { ok: true; newOrderTotal: number; correctionAmount: number }
  | { error: string }
> {
  try {
    const admin = await requireAdmin();
    const db = getDb();

    const [line] = await db
      .select({
        orderLineId: orders.orderLineId,
        cycleId: orders.cycleId,
        memberId: orders.memberId,
        memberEmail: members.email,
        quantity: orders.quantity,
        unitPriceSnapshot: orders.unitPriceSnapshot,
        lineTotal: orders.lineTotal,
        actualQuantity: orders.actualQuantity,
        actualLineTotal: orders.actualLineTotal,
        productName: products.name,
        productUnit: products.unit,
        cycleTitle: orderCycles.title,
        cycleStatus: orderCycles.status,
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.productId))
      .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
      .innerJoin(members, eq(orders.memberId, members.memberId))
      .where(eq(orders.orderLineId, input.orderLineId))
      .limit(1);
    if (!line) return { error: t.errors.orderLineNotFound };
    if (line.cycleStatus !== "closed")
      return { error: t.errors.cycleNotClosedUseNormal };

    // Parse + validate inputs.
    const parseNum = (s: string | null): number | null => {
      if (s == null || s.trim() === "") return null;
      const n = parseFloat(s.replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? n : NaN;
    };
    const newActualQty = parseNum(input.actualQuantity);
    const newActualTotal = parseNum(input.actualLineTotal);
    if (newActualQty !== null && Number.isNaN(newActualQty))
      return { error: t.errors.actualQtyInvalid };
    if (newActualTotal !== null && Number.isNaN(newActualTotal))
      return { error: t.errors.actualTotalInvalid };

    const unitPrice = parseFloat(line.unitPriceSnapshot);
    const originalTotal = parseFloat(line.lineTotal);
    const prevEffective =
      line.actualLineTotal != null ? parseFloat(line.actualLineTotal) : originalTotal;

    // Compute the new effective total. Priority:
    //   1. explicit actualLineTotal if provided
    //   2. actualQuantity * unitPrice
    //   3. fall back to the original lineTotal (reset case)
    let newEffective: number;
    if (newActualTotal !== null) {
      newEffective = newActualTotal;
    } else if (newActualQty !== null) {
      newEffective = Math.round(newActualQty * unitPrice * 100) / 100;
    } else {
      newEffective = originalTotal;
    }

    const delta = Math.round((prevEffective - newEffective) * 100) / 100;

    await db
      .update(orders)
      .set({
        actualQuantity: newActualQty != null ? newActualQty.toFixed(3) : null,
        actualLineTotal:
          newActualTotal != null
            ? newActualTotal.toFixed(2)
            : newActualQty != null
              ? newEffective.toFixed(2)
              : null,
        updatedAt: new Date(),
      })
      .where(eq(orders.orderLineId, line.orderLineId));

    let correctionAmount = 0;
    if (Math.abs(delta) >= 0.005) {
      // Sign convention: positive `delta` means the member overpaid (refund)
      // — same as adminEditClosedOrder so /storico renders consistently.
      const now = new Date();
      const noteParts: string[] = [];
      if (newActualQty !== null) {
        const qtyText = Number.isInteger(newActualQty)
          ? `${newActualQty}`
          : newActualQty.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
        const unit = line.productUnit ?? "";
        noteParts.push(
          t.notificationsServer.orderLineAdjustedNoteReceived(
            line.productName,
            `${line.quantity}${unit ? ` ${unit}` : ""}`,
            `${qtyText}${unit ? ` ${unit}` : ""}`,
          ),
        );
      } else if (newActualTotal !== null) {
        noteParts.push(
          t.notificationsServer.orderLineAdjustedNoteCost(line.productName, formatMoney(newEffective)),
        );
      } else {
        noteParts.push(t.notificationsServer.orderLineAdjustedNoteReverted(line.productName));
      }

      await db.insert(ledgerEntries).values({
        entryId: genId("led"),
        memberId: line.memberId,
        entryDate: now,
        type: "correction",
        amount: delta.toFixed(2),
        cycleId: line.cycleId,
        note: noteParts.join(" · "),
        createdBy: admin.email,
        createdAt: now,
      });
      correctionAmount = delta;

      const adjustedBody =
        delta > 0
          ? t.notificationsServer.orderLineAdjustedBodyRefund
          : t.notificationsServer.orderLineAdjustedBodyCharge;
      await dispatchNotification(db, {
        memberId: line.memberId,
        memberEmail: line.memberEmail,
        type: "order_adjusted",
        title: t.notificationsServer.orderLineAdjustedTitle(line.cycleTitle),
        body: adjustedBody(noteParts.join(" · "), formatMoney(Math.abs(delta))),
        href: "/storico",
      });
    }

    // Recompute the member's effective order total purely for the response.
    const [agg] = await db
      .select({
        total: sql<string>`sum(coalesce(${orders.actualLineTotal}, ${orders.lineTotal}))`,
      })
      .from(orders)
      .where(and(eq(orders.cycleId, line.cycleId), eq(orders.memberId, line.memberId)));
    const newOrderTotal = parseFloat(agg?.total ?? "0");

    await writeAudit(db, admin.email, "order_line_actuals_updated", "order", line.orderLineId, {
      cycleId: line.cycleId,
      memberId: line.memberId,
      prevEffective,
      newEffective,
      delta,
      actualQuantity: newActualQty,
      actualLineTotal: newActualTotal,
    });

    revalidatePath("/admin");
    revalidatePath("/storico");
    revalidatePath("/notifiche");
    revalidatePath("/");
    return { ok: true, newOrderTotal, correctionAmount };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.correctionError };
  }
}

// ── Post-close order editing ─────────────────────────────────────────────────
//
// Lets an admin tweak a member's order *after* the cycle has been closed
// (e.g. someone forgets to include eggs, or a product turned out to be
// unavailable). The original `order_charge` ledger entry is left intact;
// the delta vs the new total is posted as a separate `correction` row so
// the audit trail is preserved and the change is fully reversible by
// posting an inverse correction. Unless the cycle is manual, its shipping is
// re-split in the same batch (prepareShippingRecompute).
//
// Empty new-line lists also delete every order row for that member in the
// cycle, which makes "rimuovi l'intero ordine" work too.

export type EditClosedOrderInput = {
  cycleId: string;
  memberId: string;
  // Final desired state of the member's order. Lines with quantity ≤ 0 are
  // ignored.
  lines: Array<{ productId: string; quantity: number }>;
  // Free-form motivation that ends up on the ledger entry and notification.
  note?: string;
};

export async function adminEditClosedOrder(input: EditClosedOrderInput) {
  const admin = await requireAdmin();
  const db = getDb();
  const now = new Date();

  const [cycle] = await db
    .select({
      status: orderCycles.status,
      title: orderCycles.title,
      shippingMode: orderCycles.shippingMode,
      shippingCostPerMember: orderCycles.shippingCostPerMember,
      shippingTotal: orderCycles.shippingTotal,
    })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, input.cycleId))
    .limit(1);
  if (!cycle) throw new Error(t.errors.cycleNotFound);
  if (cycle.status !== "closed") {
    throw new Error(t.errors.orderEditOnlyAfterClose);
  }

  const [member] = await db
    .select({ memberId: members.memberId, fullName: members.fullName, email: members.email })
    .from(members)
    .where(eq(members.memberId, input.memberId))
    .limit(1);
  if (!member) throw new Error(t.errors.memberNotFound);

  // Pull the current order rows so we can compute the delta. Actuals are
  // needed because a weighed line's effective total is actual_line_total.
  const previousLines = await db
    .select({
      orderLineId: orders.orderLineId,
      productId: orders.productId,
      quantity: orders.quantity,
      unitPriceSnapshot: orders.unitPriceSnapshot,
      lineTotal: orders.lineTotal,
      actualQuantity: orders.actualQuantity,
      actualLineTotal: orders.actualLineTotal,
    })
    .from(orders)
    .where(and(eq(orders.cycleId, input.cycleId), eq(orders.memberId, input.memberId)));

  // Resolve requested products against the cycle. Existing lines keep their
  // unit_price_snapshot; only products new to this order take the current
  // `products.unitPrice` (which already reflects any close-time adjustments).
  const productIds = Array.from(new Set(input.lines.map((l) => l.productId).filter(Boolean)));
  const cycleProducts = productIds.length
    ? await db
        .select({ productId: products.productId, unitPrice: products.unitPrice })
        .from(products)
        .where(and(eq(products.cycleId, input.cycleId), inArray(products.productId, productIds)))
    : [];
  const priceByProduct = new Map(cycleProducts.map((p) => [p.productId, p.unitPrice]));

  // Reject any line that points at a product not in this cycle — guards
  // against client-side tampering and stale UI state.
  for (const line of input.lines) {
    if (line.productId && Math.floor(line.quantity) > 0 && !priceByProduct.has(line.productId)) {
      throw new Error(t.errors.productNotValidForCycle);
    }
  }

  const plan = planClosedOrderEdit(previousLines, input.lines, priceByProduct);
  const { oldTotal, newTotal, delta } = plan;
  const epsilon = 0.005;

  // Shipping follows the order: re-split on the effective totals this edit
  // leaves (the member's new total is plan.newTotal). Never on a manual cycle.
  const shipping =
    cycle.shippingMode === "manual"
      ? null
      : await prepareShippingRecompute(db, input.cycleId, cycle, admin.email, now, {
          memberId: input.memberId,
          total: newTotal.toFixed(2),
        });

  // Apply the plan in one db.batch (a single Neon transaction): unchanged
  // lines are not touched, so their actuals survive; the correction entry and
  // the shipping re-split are part of the same batch, so the order rows and
  // the money can't diverge.
  const statements: BatchItem<"pg">[] = [];
  if (plan.deletes.length > 0) {
    statements.push(db.delete(orders).where(inArray(orders.orderLineId, plan.deletes)));
  }
  for (const u of plan.updates) {
    statements.push(
      db
        .update(orders)
        .set({
          quantity: u.quantity,
          lineTotal: u.lineTotal,
          actualQuantity: null,
          actualLineTotal: null,
          updatedAt: now,
        })
        .where(eq(orders.orderLineId, u.orderLineId)),
    );
  }
  if (plan.inserts.length > 0) {
    statements.push(
      db.insert(orders).values(
        plan.inserts.map((l) => ({
          orderLineId: genId("ord"),
          cycleId: input.cycleId,
          memberId: input.memberId,
          productId: l.productId,
          quantity: l.quantity,
          unitPriceSnapshot: l.unitPrice,
          lineTotal: l.lineTotal,
          updatedAt: now,
        })),
      ),
    );
  }

  // Post a correction entry only if the total actually changed. Same-total
  // edits (e.g. swap one product for another at identical price) are
  // legitimate too and need no ledger movement.
  let correctionEntryId: string | null = null;
  if (Math.abs(delta) > epsilon) {
    correctionEntryId = genId("led");
    const trimmedNote = (input.note ?? "").trim();
    const reason = trimmedNote || `Correzione ordine "${cycle.title}"`;
    statements.push(
      db.insert(ledgerEntries).values({
        entryId: correctionEntryId,
        memberId: input.memberId,
        entryDate: now,
        type: "correction",
        // delta > 0 → member ordered more → additional charge (negative ledger amount).
        // delta < 0 → member ordered less → refund (positive ledger amount).
        amount: (-delta).toFixed(2),
        cycleId: input.cycleId,
        note: reason,
        createdBy: admin.email,
        createdAt: now,
      }),
    );
  }
  if (shipping) statements.push(...shipping.statements);

  if (statements.length > 0) {
    // Lock the cycle (so a concurrent cancel, or another edit's shipping
    // re-split, waits for this one) and the member's lines, then check in a
    // fresh snapshot that the cycle is still closed, the lines are exactly the
    // ones the plan was computed from and so is the shipping state. Otherwise
    // 1/0 aborts the batch: a double submit or a concurrent weighing must not
    // post a second correction on a stale delta.
    const lock = db.execute(
      sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${input.cycleId} FOR UPDATE`,
    );
    const lockLines = db.execute(
      sql`SELECT 1 FROM orders
          WHERE cycle_id = ${input.cycleId} AND member_id = ${input.memberId} FOR UPDATE`,
    );
    const guard = db.execute(
      sql`SELECT 1 / (CASE WHEN
            (SELECT status FROM order_cycles WHERE cycle_id = ${input.cycleId}) = 'closed'
            AND (SELECT coalesce(jsonb_object_agg(order_line_id,
                   jsonb_build_array(quantity, line_total::text, actual_line_total::text)), '{}'::jsonb)
                 FROM orders
                 WHERE cycle_id = ${input.cycleId} AND member_id = ${input.memberId})
                = ${orderLinesSnapshot(previousLines)}::jsonb
            AND ${shipping ? shipping.guard : sql`TRUE`}
          THEN 1 ELSE 0 END) AS edit_guard`,
    );
    try {
      await db.batch([lock, lockLines, guard, ...statements]);
    } catch (e) {
      // 22012 = division_by_zero, i.e. the guard fired.
      if (e instanceof Error && /22012|division by zero/i.test(e.message)) {
        throw new Error(t.errors.closedOrderChanged);
      }
      throw e;
    }
  }

  // Member-facing notification with the human-readable diff.
  const [balanceRow] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.memberId, input.memberId));
  const newBalance = parseFloat(balanceRow?.total ?? "0");

  // The edited member gets a single notification: a change to their own
  // shipping share is folded into it, so the new balance it quotes adds up.
  // Other members whose share moved get the shipping one.
  const shippingChanges = shipping?.plan.changes ?? [];
  const ownShipping = shippingChanges.find((c) => c.memberId === input.memberId);

  const orderSentence =
    Math.abs(delta) <= epsilon
      ? ownShipping
        ? t.notificationsServer.orderModifiedBodyUpdated(cycle.title)
        : t.notificationsServer.orderModifiedBodyNoChange(cycle.title)
      : delta > 0
        ? t.notificationsServer.orderModifiedBodyCharge(cycle.title, formatMoney(delta))
        : t.notificationsServer.orderModifiedBodyRefund(cycle.title, formatMoney(-delta));
  const dirSentence = ownShipping
    ? `${orderSentence} ${t.notificationsServer.orderModifiedShipping(
        formatMoney(ownShipping.oldShare),
        formatMoney(ownShipping.newShare),
      )}`
    : orderSentence;

  await notifyShippingChanges(
    db,
    input.cycleId,
    cycle.title,
    shippingChanges.filter((c) => c.memberId !== input.memberId),
    now,
  );
  await dispatchNotification(db, {
    memberId: input.memberId,
    memberEmail: member.email,
    type: "order_corrected",
    title: t.notificationsServer.orderModifiedTitle,
    body: t.notificationsServer.orderModifiedBody(dirSentence, formatMoney(newBalance)),
    href: `/storico?cycleId=${input.cycleId}`,
    createdAt: now,
  });

  await writeAudit(db, admin.email, "edit_closed_order", "order", input.cycleId, {
    cycleId: input.cycleId,
    memberId: input.memberId,
    oldTotal: oldTotal.toFixed(2),
    newTotal: newTotal.toFixed(2),
    delta: delta.toFixed(2),
    correctionEntryId,
    lineCount: previousLines.length - plan.deletes.length + plan.inserts.length,
    updatedLines: plan.updates.length,
    note: input.note ?? null,
    shippingChanges,
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/storico");

  return {
    oldTotal: Number(oldTotal.toFixed(2)),
    newTotal: Number(newTotal.toFixed(2)),
    delta: Number(delta.toFixed(2)),
    newBalance: Number(newBalance.toFixed(2)),
    correctionEntryId,
  };
}

// Full snapshot of a ledger row for the audit log, so an edit or a delete can
// be reconstructed from audit_log alone.
const ledgerAuditColumns = {
  entryId: ledgerEntries.entryId,
  memberId: ledgerEntries.memberId,
  type: ledgerEntries.type,
  amount: ledgerEntries.amount,
  cycleId: ledgerEntries.cycleId,
  note: ledgerEntries.note,
  entryDate: ledgerEntries.entryDate,
  paymentId: ledgerEntries.paymentId,
  method: ledgerEntries.method,
  externalRef: ledgerEntries.externalRef,
};

export async function adminUpdateLedgerEntry(
  entryId: string,
  data: { amount: number; note: string },
): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const [before] = await db
      .select(ledgerAuditColumns)
      .from(ledgerEntries)
      .where(eq(ledgerEntries.entryId, entryId))
      .limit(1);
    if (!before) return { error: t.errors.ledgerEntryNotFound };
    if (before.paymentId) return { error: t.errors.ledgerEntryFromOnlinePayment };

    const amountError = validateLedgerEntryEdit(before, data.amount);
    if (amountError) return { error: ledgerAmountErrorMessage(amountError) };
    // The member was told why the money left: the causale stays.
    if (isOutgoingLedgerType(before.type) && !data.note?.trim()) {
      return { error: t.admin.treasury.movementErrors.noteRequired };
    }
    // Growing a payout returns more money: it may not exceed the balance.
    if (before.type === "payout") {
      const balance = await memberBalance(db, before.memberId);
      const excess = validatePayoutAmount(Math.abs(data.amount), balance, parseFloat(before.amount));
      if (excess) return { error: t.admin.treasury.movementErrors.payoutExceedsBalance(formatMoney(excess.limit)) };
    }

    const after = { ...before, amount: data.amount.toFixed(2), note: data.note };
    await db
      .update(ledgerEntries)
      .set({ amount: after.amount, note: after.note, updatedBy: admin.email, updatedAt: new Date() })
      .where(eq(ledgerEntries.entryId, entryId));
    await writeAudit(db, admin.email, "update_ledger", "ledger", entryId, { before, after });
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/storico");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

export async function adminDeleteLedgerEntry(entryId: string): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const [before] = await db
      .select(ledgerAuditColumns)
      .from(ledgerEntries)
      .where(eq(ledgerEntries.entryId, entryId))
      .limit(1);
    if (!before) return { error: t.errors.ledgerEntryNotFound };
    if (!isAdminEditableLedgerType(before.type)) return { error: t.errors.ledgerEntryNotEditable };
    if (before.paymentId) return { error: t.errors.ledgerEntryFromOnlinePayment };

    await db.delete(ledgerEntries).where(eq(ledgerEntries.entryId, entryId));
    await writeAudit(db, admin.email, "delete_ledger", "ledger", entryId, { before, after: null });
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/storico");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

export async function adminDeleteMember(memberId: string): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();

    const [[orderCount], [ledgerCount], [paymentCount]] = await Promise.all([
      db.select({ n: sql<string>`count(*)` }).from(orders).where(eq(orders.memberId, memberId)),
      db
        .select({ n: sql<string>`count(*)` })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.memberId, memberId)),
      // Even an abandoned checkout leaves a payments row pointing at the member.
      db.select({ n: sql<string>`count(*)` }).from(payments).where(eq(payments.memberId, memberId)),
    ]);

    if (
      parseInt(orderCount?.n ?? "0") > 0 ||
      parseInt(ledgerCount?.n ?? "0") > 0 ||
      parseInt(paymentCount?.n ?? "0") > 0
    ) {
      return {
        error: t.errors.cannotDeleteMemberWithData,
      };
    }

    await db.delete(members).where(eq(members.memberId, memberId));
    await writeAudit(db, admin.email, "delete_member", "member", memberId);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

// ── Soci ──────────────────────────────────────────────────────────────────────

export type UpsertMemberInput = {
  memberId?: string;
  fullName: string;
  email: string;
  aliasEmail?: string;
  role: string;
  active: boolean;
};

// Emails and aliases share one namespace (lib/member-email.ts). The message
// names the member who already holds the address, so the admin can fix it.
async function memberEmailConflict(
  memberId: string | undefined,
  wanted: { email: string; aliasEmail: string | null },
): Promise<string | null> {
  const holders = await getMembersByEmails([wanted.email, wanted.aliasEmail].filter((a) => a !== null));
  const conflict = findEmailConflict(memberId, wanted, holders);
  return conflict ? t.admin.members.emailInUse(conflict.address, conflict.fullName) : null;
}

export async function adminUpsertMember(data: UpsertMemberInput): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!data.fullName?.trim()) throw new Error(t.errors.fieldRequired(t.fields.name));
  const email = normalizeEmail(data.email);
  if (!email) throw new Error(t.errors.fieldRequired(t.fields.email));
  const role = normalizeRole(data.role);
  if (!role) throw new Error(t.errors.invalidRole);

  const aliasEmail = normalizeEmail(data.aliasEmail);
  const db = getDb();
  const now = new Date();

  // A taken address is returned, not thrown: Next.js masks thrown Server
  // Action messages in production, and the admin needs to read this one.
  const conflict = await memberEmailConflict(data.memberId, { email, aliasEmail });
  if (conflict) return { error: conflict };

  try {
    if (data.memberId) {
      await db
        .update(members)
        .set({
          fullName: data.fullName.trim(),
          email,
          aliasEmail,
          role,
          active: data.active,
          updatedAt: now,
        })
        .where(eq(members.memberId, data.memberId));
      await writeAudit(db, admin.email, "update_member", "member", data.memberId, { ...data, role });
    } else {
      const memberId = genId("mem");
      await db.insert(members).values({
        memberId,
        fullName: data.fullName.trim(),
        email,
        aliasEmail,
        role,
        active: data.active,
        createdAt: now,
        updatedAt: now,
      });
      await writeAudit(db, admin.email, "create_member", "member", memberId, { ...data, role });
    }
  } catch (e) {
    // A concurrent save took the address after the check above: the unique
    // indexes (migration 0017) reject the write. Report it the same way.
    const raced = isUniqueViolation(e) ? await memberEmailConflict(data.memberId, { email, aliasEmail }) : null;
    if (raced) return { error: raced };
    throw e;
  }

  revalidatePath("/admin");
  return {};
}

// ── Fornitori ─────────────────────────────────────────────────────────────────

export type UpsertSupplierInput = {
  supplierId?: string;
  name: string;
  macroCategory?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active?: boolean;
};

export async function adminUpsertSupplier(data: UpsertSupplierInput) {
  const admin = await requireAdmin();
  if (!data.name?.trim()) throw new Error(t.errors.fieldRequired(t.fields.name));

  const db = getDb();
  const now = new Date();
  const trim = (v?: string) => v?.trim() || null;

  if (data.supplierId) {
    await db
      .update(suppliers)
      .set({
        name: data.name.trim(),
        macroCategory: trim(data.macroCategory),
        contactName: trim(data.contactName),
        phone: trim(data.phone),
        email: trim(data.email),
        address: trim(data.address),
        notes: trim(data.notes),
        active: data.active ?? true,
      })
      .where(eq(suppliers.supplierId, data.supplierId));
    await writeAudit(db, admin.email, "update_supplier", "supplier", data.supplierId, data);
  } else {
    const supplierId = genId("sup");
    await db.insert(suppliers).values({
      supplierId,
      name: data.name.trim(),
      macroCategory: trim(data.macroCategory),
      contactName: trim(data.contactName),
      phone: trim(data.phone),
      email: trim(data.email),
      address: trim(data.address),
      notes: trim(data.notes),
      active: data.active ?? true,
      createdAt: now,
    });
    await writeAudit(db, admin.email, "create_supplier", "supplier", supplierId, data);
  }
  revalidatePath("/admin");
}

export async function adminArchiveSupplier(supplierId: string, active: boolean) {
  const admin = await requireAdmin();
  const db = getDb();
  await db.update(suppliers).set({ active }).where(eq(suppliers.supplierId, supplierId));
  await writeAudit(db, admin.email, active ? "unarchive_supplier" : "archive_supplier", "supplier", supplierId);
  revalidatePath("/admin");
}

export async function adminDeleteSupplier(supplierId: string): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const [cycleCount] = await db
      .select({ n: sql<string>`count(*)` })
      .from(orderCycles)
      .where(eq(orderCycles.supplierId, supplierId));
    if (parseInt(cycleCount?.n ?? "0") > 0) {
      return { error: t.errors.cannotDeleteSupplierWithCycles };
    }
    await db.delete(suppliers).where(eq(suppliers.supplierId, supplierId));
    await writeAudit(db, admin.email, "delete_supplier", "supplier", supplierId);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

// ── Catalogo Fornitori ────────────────────────────────────────────────────────

export type UpsertCatalogProductInput = {
  catalogProductId?: string;
  supplierId: string;
  name: string;
  variant?: string;
  format?: string;
  unit?: string;
  unitPrice: number;
  pricePerKg?: number | null;
  notes?: string;
  category?: string;
  emoji?: string;
};

export async function adminUpsertCatalogProduct(data: UpsertCatalogProductInput): Promise<{error?: string; archived?: boolean}> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const now = new Date();

    if (data.catalogProductId) {
      const [existing] = await db
        .select()
        .from(supplierProducts)
        .where(eq(supplierProducts.catalogProductId, data.catalogProductId))
        .limit(1);

      if (!existing) return { error: t.errors.catalogProductNotFound };

      const pricePerKg =
        data.pricePerKg != null && !Number.isNaN(data.pricePerKg)
          ? data.pricePerKg.toFixed(2)
          : null;

      if (parseFloat(existing.unitPrice) !== data.unitPrice) {
        // Price changed -> archive old and insert new
        await db.update(supplierProducts).set({ active: false, archivedAt: now }).where(eq(supplierProducts.catalogProductId, data.catalogProductId));
        const newId = genId("cat");
        await db.insert(supplierProducts).values({
          catalogProductId: newId,
          supplierId: data.supplierId,
          name: data.name,
          variant: data.variant || null,
          format: data.format || null,
          unit: data.unit || null,
          unitPrice: data.unitPrice.toFixed(2),
          pricePerKg,
          notes: data.notes || null,
          category: data.category || null,
          emoji: data.emoji || null,
          active: true,
          createdAt: now,
        });
        await writeAudit(db, admin.email, "upsert_catalog_product", "catalog", newId, data);
        revalidatePath("/admin");
        return { archived: true };
      } else {
        // Simple update
        await db
          .update(supplierProducts)
          .set({
            name: data.name,
            variant: data.variant || null,
            format: data.format || null,
            unit: data.unit || null,
            unitPrice: data.unitPrice.toString(),
            pricePerKg,
            notes: data.notes || null,
            category: data.category || null,
            emoji: data.emoji || null,
          })
          .where(eq(supplierProducts.catalogProductId, data.catalogProductId));
        await writeAudit(db, admin.email, "update_catalog_product", "catalog", data.catalogProductId, data);
        revalidatePath("/admin");
        return {};
      }
    } else {
      const pricePerKg =
        data.pricePerKg != null && !Number.isNaN(data.pricePerKg)
          ? data.pricePerKg.toFixed(2)
          : null;
      const newId = genId("cp");
      await db.insert(supplierProducts).values({
        catalogProductId: newId,
        supplierId: data.supplierId,
        name: data.name,
        variant: data.variant || null,
        format: data.format || null,
        unit: data.unit || null,
        unitPrice: data.unitPrice.toString(),
        pricePerKg,
        notes: data.notes || null,
        category: data.category || null,
        emoji: data.emoji || null,
        active: true,
        createdAt: now,
      });
      await writeAudit(db, admin.email, "create_catalog_product", "catalog", newId, data);
      revalidatePath("/admin");
      return {};
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

export async function adminArchiveCatalogProduct(catalogProductId: string, active: boolean): Promise<{error?: string}> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    await db.update(supplierProducts).set({ active, archivedAt: active ? null : new Date() }).where(eq(supplierProducts.catalogProductId, catalogProductId));
    await writeAudit(db, admin.email, active ? "unarchive_catalog_product" : "archive_catalog_product", "catalog", catalogProductId);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

export async function adminLoadFromCatalog(cycleId: string, catalogProductIds: string[]): Promise<{error?: string; count?: number}> {
  try {
    if (!catalogProductIds.length) return { error: t.errors.noProductsSelected };
    const admin = await requireAdmin();
    const db = getDb();

    const selectedProducts = await db
      .select()
      .from(supplierProducts)
      .where(and(inArray(supplierProducts.catalogProductId, catalogProductIds), eq(supplierProducts.active, true)));

    if (!selectedProducts.length) return { error: t.errors.productsNotFoundOrInactive };

    await upsertCycleProducts(db, cycleId, selectedProducts.map(p => ({
      name: p.name,
      variant: p.variant,
      format: p.format,
      unitPrice: p.unitPrice,
      pricePerKg: p.pricePerKg,
      unit: p.unit,
      supplier: null, // the cycle supplier is implicit
      supplierId: p.supplierId,
      notes: p.notes,
      category: p.category,
      emoji: p.emoji,
    })));

    await writeAudit(db, admin.email, "load_catalog_products", "cycle", cycleId, { count: selectedProducts.length });
    revalidatePath("/admin");
    revalidatePath("/ordine");

    return { count: selectedProducts.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

export async function adminRemoveProductFromCycle(productId: string): Promise<{error?: string}> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    await db.delete(products).where(eq(products.productId, productId));
    await writeAudit(db, admin.email, "remove_product_from_cycle", "product", productId);
    revalidatePath("/admin");
    revalidatePath("/ordine");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

export async function adminGetCatalogBySupplier(supplierId: string) {
  await requireAdmin();
  const { getCatalogBySupplier } = await import("@/lib/db/queries");
  return getCatalogBySupplier(supplierId);
}

export async function adminGetCycleProducts(cycleId: string) {
  await requireAdmin();
  const { getAdminCycleProducts } = await import("@/lib/db/queries");
  return getAdminCycleProducts(cycleId);
}

export async function adminGetCycleProductsForReview(cycleId: string) {
  await requireAdmin();
  const { getCycleProductsForReview } = await import("@/lib/db/queries");
  return getCycleProductsForReview(cycleId);
}

// ── Supplier distinta import ─────────────────────────────────────────────────

// Builds the distinta workbook for an admin who wants to download it (or
// re-download after sending). Returns the bytes as a base64 string so the
// client can wrap it in a Blob and trigger a download — keeps the wire
// JSON-safe.
export async function adminBuildSupplierDistinta(
  cycleId: string,
): Promise<{ ok: true; filename: string; base64: string } | { error: string }> {
  try {
    await requireAdmin();
    const { buildSupplierDistinta } = await import("@/lib/csv/distinta-builder");
    const r = await buildSupplierDistinta(cycleId);
    return { ok: true, filename: r.filename, base64: r.content.toString("base64") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.distintaGenerationError };
  }
}

// Reads a supplier-filled distinta and returns a diff preview WITHOUT
// touching the DB. The client renders it; the admin confirms; then
// adminApplyDistintaImport actually writes.
export async function adminPreviewDistintaImport(input: {
  cycleId: string;
  fileBase64: string;
  fileName?: string;
}): Promise<
  | { ok: true; preview: import("@/lib/csv/distinta-parser").DistintaImportPreview }
  | { error: string }
> {
  try {
    await requireAdmin();
    const { decodeUploadBase64 } = await import("@/lib/upload-limit");
    const buf = decodeUploadBase64(input.fileBase64);
    const { parseSupplierDistinta } = await import("@/lib/csv/distinta-parser");
    const preview = await parseSupplierDistinta(buf, input.cycleId, input.fileName);
    return { ok: true, preview };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.distintaReadError };
  }
}

// Applies the diff: re-parses the file (paranoia / state could have shifted),
// then for every line correction reuses adminUpdateOrderLineActuals so the
// existing correction-ledger + notification flow is honored. Shipping
// changes go straight to the ledger (upsert) so we can support per-member
// custom values; the cycle's shippingMode is flipped to "manual" so the
// automatic recompute leaves them alone.
export async function adminApplyDistintaImport(input: {
  cycleId: string;
  fileBase64: string;
  fileName?: string;
}): Promise<
  | {
      ok: true;
      corrections: number;
      shippingChanges: number;
      warnings: string[];
      affectedMembers: number;
    }
  | { error: string; warnings?: string[]; errors?: string[] }
> {
  try {
    const admin = await requireAdmin();
    const { decodeUploadBase64 } = await import("@/lib/upload-limit");
    const buf = decodeUploadBase64(input.fileBase64);
    const { parseSupplierDistinta } = await import("@/lib/csv/distinta-parser");
    const preview = await parseSupplierDistinta(buf, input.cycleId, input.fileName);
    if (preview.errors.length > 0) {
      return {
        error: preview.errors[0],
        errors: preview.errors,
        warnings: preview.warnings,
      };
    }

    const db = getDb();
    const now = new Date();
    const affected = new Set<string>();

    // Per-member summary so the single notification we emit at the end is
    // useful (lists the relevant changes for that socio).
    type ChangeSummary = { product: string; oldTotal: number; newTotal: number };
    const linesByMember = new Map<string, ChangeSummary[]>();
    const shippingByMember = new Map<string, { oldShipping: number; newShipping: number }>();

    // 1) Line corrections — reuse the per-line action so the correction
    // ledger entry + per-line notification model stays identical to manual
    // edits. We swallow individual notifications by NOT relying on them in
    // the summary — but we keep them on, since they carry the per-line
    // diff which is also useful.
    for (const c of preview.corrections) {
      const res = await adminUpdateOrderLineActuals({
        orderLineId: c.orderLineId,
        actualQuantity: null,
        actualLineTotal: c.newTotal.toFixed(2),
      });
      if ("error" in res) {
        return { error: `Errore su ${c.memberName} · ${c.productName}: ${res.error}` };
      }
      affected.add(c.memberId);
      const arr = linesByMember.get(c.memberId) ?? [];
      arr.push({ product: c.productName, oldTotal: c.oldTotal, newTotal: c.newTotal });
      linesByMember.set(c.memberId, arr);
    }

    // 2) Shipping changes — upsert ledger entries per member, then flip the
    // cycle to manual mode.
    if (preview.shippingChanges.length > 0) {
      const existing = await db
        .select({
          entryId: ledgerEntries.entryId,
          memberId: ledgerEntries.memberId,
        })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.cycleId, input.cycleId),
            eq(ledgerEntries.type, "shipping_charge"),
          ),
        );
      const existingByMember = new Map(existing.map((e) => [e.memberId, e.entryId]));

      for (const s of preview.shippingChanges) {
        const newAmount = -s.newShipping; // ledger stores it as negative charge
        const prev = existingByMember.get(s.memberId);
        if (prev) {
          await db
            .update(ledgerEntries)
            .set({
              amount: newAmount.toFixed(2),
              note: t.ledger.shippingFromSupplier,
              updatedAt: now,
              updatedBy: admin.email,
            })
            .where(eq(ledgerEntries.entryId, prev));
        } else if (s.newShipping > 0) {
          await db.insert(ledgerEntries).values({
            entryId: genId("led"),
            memberId: s.memberId,
            entryDate: now,
            type: "shipping_charge",
            amount: newAmount.toFixed(2),
            cycleId: input.cycleId,
            note: t.ledger.shippingFromSupplier,
            createdBy: admin.email,
            createdAt: now,
          });
        }
        affected.add(s.memberId);
        shippingByMember.set(s.memberId, {
          oldShipping: s.oldShipping,
          newShipping: s.newShipping,
        });
      }

      await db
        .update(orderCycles)
        .set({ shippingMode: "manual" })
        .where(eq(orderCycles.cycleId, input.cycleId));
    }

    // 3) Per-member roll-up notification (one extra notification on top of
    // the per-line ones from step 1 — gives the socio the full picture).
    const affectedIds = [...affected];
    const [distintaEmails, distintaPrefs] = await Promise.all([
      getMemberEmails(db, affectedIds),
      getResolvedPreferences(db, affectedIds),
    ]);
    for (const memberId of affected) {
      const lineChanges = linesByMember.get(memberId) ?? [];
      const shipChange = shippingByMember.get(memberId);
      const bits: string[] = [];
      if (lineChanges.length > 0) {
        const subset = lineChanges.slice(0, 3).map(
          (l) => `${l.product}: ${formatMoney(l.oldTotal)} → ${formatMoney(l.newTotal)} €`,
        );
        const more = lineChanges.length > 3 ? ` (+${lineChanges.length - 3} altre)` : "";
        bits.push(`Prodotti aggiornati dal fornitore: ${subset.join("; ")}${more}.`);
      }
      if (shipChange) {
        bits.push(
          `Spedizione: ${formatMoney(shipChange.oldShipping)} → ${formatMoney(shipChange.newShipping)} €.`,
        );
      }
      if (bits.length === 0) continue;
      await dispatchNotification(
        db,
        {
          memberId,
          memberEmail: distintaEmails.get(memberId) ?? null,
          type: "order_adjusted",
          title: t.notificationsServer.pesataRegistrataTitle,
          body: bits.join(" "),
          href: "/storico",
        },
        distintaPrefs.get(memberId),
      );
    }

    await writeAudit(
      db,
      admin.email,
      "supplier_distinta_imported",
      "cycle",
      input.cycleId,
      {
        corrections: preview.corrections.length,
        shippingChanges: preview.shippingChanges.length,
        affectedMembers: affected.size,
        warnings: preview.warnings,
      },
    );

    revalidatePath("/admin");
    revalidatePath("/storico");
    revalidatePath("/");

    return {
      ok: true,
      corrections: preview.corrections.length,
      shippingChanges: preview.shippingChanges.length,
      warnings: preview.warnings,
      affectedMembers: affected.size,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.importApplyError };
  }
}
