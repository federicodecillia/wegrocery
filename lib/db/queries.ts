import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import { liveLedger } from "./ledger-live";
import {
  ledgerEntries,
  familyInvites,
  guideSearchMisses,
  memberDuplicateDismissals,
  members,
  notificationPreferences,
  notifications,
  orderCycles,
  orderDrafts,
  orders,
  payments,
  products,
  suppliers,
  supplierProducts,
  type DraftLine,
} from "./schema";
import { buildCycleHistory, type CycleHistoryEntry } from "@/lib/cycle-history";
import { MISS_RETENTION_DAYS } from "@/lib/guide/search-misses";
import { normalizeEmail } from "@/lib/member-email";
import { normalizeDraftLines } from "@/lib/order-draft";
import { cycleHandlingFee, type HandlingFee } from "@/lib/payments/order-payment";

// Matches the login email or alias; stored addresses are normalized on write.
export async function getMemberByEmail(email: string) {
  const address = normalizeEmail(email);
  if (!address) return null;
  const db = getDb();
  const [member] = await db
    .select()
    .from(members)
    .where(or(eq(members.email, address), eq(members.aliasEmail, address)))
    .limit(1);
  return member ?? null;
}

export async function getMemberById(memberId: string) {
  const db = getDb();
  const [member] = await db.select().from(members).where(eq(members.memberId, memberId)).limit(1);
  return member ?? null;
}

// Members holding one of `addresses` as email or alias, compared lower-cased
// like the unique indexes of drizzle/0017_member_email_unique.sql.
export async function getMembersByEmails(addresses: string[]) {
  if (addresses.length === 0) return [];
  const db = getDb();
  return db
    .select({
      memberId: members.memberId,
      fullName: members.fullName,
      email: members.email,
      aliasEmail: members.aliasEmail,
    })
    .from(members)
    .where(
      or(
        inArray(sql`lower(${members.email})`, addresses),
        inArray(sql`lower(${members.aliasEmail})`, addresses),
      ),
    );
}

// The people of an account: its own person first, then those who joined it
// (members.household_of, lib/members/family.ts).
export async function getFamilyPeople(accountId: string) {
  const db = getDb();
  return db
    .select({
      memberId: members.memberId,
      fullName: members.fullName,
      email: members.email,
      aliasEmail: members.aliasEmail,
      role: members.role,
      active: members.active,
      householdOf: members.householdOf,
    })
    .from(members)
    .where(or(eq(members.memberId, accountId), eq(members.householdOf, accountId)))
    .orderBy(sql`${members.memberId} = ${accountId} DESC`, asc(members.fullName));
}

// The account plus the people who joined it: Storico shows the history each
// of them had before joining (their own rows hold no money once joined).
export async function getFamilyMemberIds(accountId: string): Promise<string[]> {
  const people = await getFamilyPeople(accountId);
  return people.length > 0 ? people.map((p) => p.memberId) : [accountId];
}

export type FamilyInviteItem = {
  inviteId: string;
  accountId: string;
  accountName: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  expiresAt: Date;
};

// Pending, unexpired invitations sent to a person or from an account.
export async function getPendingFamilyInvites(filter: { toMemberId?: string; fromAccountId?: string }) {
  const db = getDb();
  const account = sql`(SELECT a.full_name FROM members a WHERE a.member_id = ${familyInvites.accountId})`;
  const conditions = [eq(familyInvites.status, "pending"), sql`${familyInvites.expiresAt} > now()`];
  if (filter.toMemberId) conditions.push(eq(familyInvites.memberId, filter.toMemberId));
  if (filter.fromAccountId) conditions.push(eq(familyInvites.accountId, filter.fromAccountId));
  return db
    .select({
      inviteId: familyInvites.inviteId,
      accountId: familyInvites.accountId,
      accountName: sql<string>`${account}`,
      memberId: familyInvites.memberId,
      memberName: members.fullName,
      memberEmail: members.email,
      expiresAt: familyInvites.expiresAt,
    })
    .from(familyInvites)
    .innerJoin(members, eq(members.memberId, familyInvites.memberId))
    .where(and(...conditions))
    .orderBy(desc(familyInvites.createdAt)) as Promise<FamilyInviteItem[]>;
}

export async function getMemberBalance(memberId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.memberId, memberId));
  return parseFloat(row?.total ?? "0");
}

// Order totals that are saved but not yet charged to the ledger: the member's
// lines on OTHER wallet cycles still `open` (closing is what posts
// order_charge; a card cycle's order is paid already and stays off the
// wallet), and the member's current total on `cycleId`, which a save replaces.
export async function getMemberPendingOrderTotals(
  memberId: string,
  cycleId: string,
): Promise<{ otherOpenCycles: number; thisCycle: number }> {
  const db = getDb();
  const [row] = await db
    .select({
      other: sql<string>`coalesce(sum(${orders.lineTotal}) filter (where ${orders.cycleId} <> ${cycleId} and ${orderCycles.paymentMode} <> 'per_order'), '0')`,
      current: sql<string>`coalesce(sum(${orders.lineTotal}) filter (where ${orders.cycleId} = ${cycleId}), '0')`,
    })
    .from(orders)
    .innerJoin(orderCycles, eq(orderCycles.cycleId, orders.cycleId))
    .where(and(eq(orders.memberId, memberId), eq(orderCycles.status, "open")));
  return {
    otherOpenCycles: parseFloat(row?.other ?? "0"),
    thisCycle: parseFloat(row?.current ?? "0"),
  };
}

export async function getOpenCycles(includeExpired = false) {
  const db = getDb();
  const rows = await db
    .select()
    .from(orderCycles)
    .leftJoin(suppliers, eq(orderCycles.supplierId, suppliers.supplierId))
    .where(
      includeExpired
        ? eq(orderCycles.status, "open")
        : and(
            eq(orderCycles.status, "open"),
            or(isNull(orderCycles.orderCloseAt), sql`${orderCycles.orderCloseAt} > now()`),
          ),
    )
    .orderBy(asc(orderCycles.orderCloseAt));
  // The supplier's name rides along for the /ordine header and cycle picker.
  return rows.map((r) => ({ ...r.order_cycles, supplierName: r.suppliers?.name ?? null }));
}

// Where the member's order payment for a cycle stands, for the notice on the
// way back from Stripe: the payment of `sessionId` when given, else nothing.
// "failed" covers an expired session too; "refunded" a payment the app gave
// back because the order could no longer take it.
export async function getOrderPaymentStatus(
  memberId: string,
  cycleId: string,
  sessionId: string | undefined,
): Promise<"pending" | "succeeded" | "refunded" | "failed" | null> {
  if (!sessionId) return null;
  const db = getDb();
  const [row] = await db
    .select({ status: payments.status })
    .from(payments)
    .where(
      and(
        eq(payments.checkoutSessionId, sessionId),
        eq(payments.memberId, memberId),
        eq(payments.cycleId, cycleId),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.status === "pending") return "pending";
  if (row.status === "failed" || row.status === "expired") return "failed";
  // Refunded right away: it arrived after the close or a product left the cycle.
  return row.status === "succeeded" ? "succeeded" : "refunded";
}

// Refunds the app asked for that Stripe has not answered (refunds.status =
// 'requested'): the Cassa tab offers to send them again.
export async function getRequestedRefundCount(): Promise<number> {
  const { rows } = await getDb().execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM refunds WHERE status = 'requested'`,
  );
  return rows[0]?.n ?? 0;
}

// The handling fee of the most recent cycle in this payment mode: the default
// of the next one. null when that cycle had none, or before the first.
export async function getLastHandlingFee(mode: "wallet" | "per_order"): Promise<HandlingFee | null> {
  const db = getDb();
  const [row] = await db
    .select({ handlingFeeType: orderCycles.handlingFeeType, handlingFeeValue: orderCycles.handlingFeeValue })
    .from(orderCycles)
    .where(eq(orderCycles.paymentMode, mode))
    .orderBy(desc(orderCycles.createdAt))
    .limit(1);
  return row ? cycleHandlingFee(row) : null;
}

export async function getCycleProducts(cycleId: string) {
  const db = getDb();
  return db
    .select()
    .from(products)
    .where(and(eq(products.cycleId, cycleId), eq(products.active, true)))
    // Alphabetical by product, then variety, then format/price, so every
    // "Cicoria" variant sits together instead of scattered in whatever
    // order rows happened to land in the DB across separate imports.
    // LOWER(...) keeps it case-insensitive (see the same pattern and
    // rationale in lib/csv/distinta-builder.ts).
    .orderBy(
      sql`lower(${products.name})`,
      sql`lower(coalesce(${products.variant}, ''))`,
      sql`lower(coalesce(${products.format}, ''))`,
      asc(products.unitPrice),
    );
}

export async function getMemberOrderLines(memberId: string, cycleId: string) {
  const db = getDb();
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.memberId, memberId), eq(orders.cycleId, cycleId)));
}

// The member's unconfirmed edits to the cycle's order (order_drafts), null
// when there are none or the stored lines are unreadable.
export async function getOrderDraft(memberId: string, cycleId: string): Promise<DraftLine[] | null> {
  const db = getDb();
  const [row] = await db
    .select({ lines: orderDrafts.lines })
    .from(orderDrafts)
    .where(and(eq(orderDrafts.memberId, memberId), eq(orderDrafts.cycleId, cycleId)))
    .limit(1);
  return row ? normalizeDraftLines(row.lines) : null;
}

// Returns the next upcoming pickup the member should care about: a cycle
// where they have at least one order line and whose pickup date (either
// pickup or pickup2) is in the future. Used by the "Prossimo ritiro" home
// card. Returns null if there is no future pickup with an order.
export type NextPickup = {
  cycleId: string;
  cycleTitle: string;
  pickupDate: Date;
  pickupEndTime: string | null;
  supplierName: string | null;
  isSecondPickup: boolean;
};

export async function getNextMemberPickup(memberId: string): Promise<NextPickup | null> {
  const db = getDb();

  // Cycles where the member has at least one order line. We don't filter
  // by status here — a member should still see the pickup info even after
  // the cycle has been closed (charges already posted but pickup is later).
  const rows = await db
    .selectDistinct({
      cycleId: orderCycles.cycleId,
      cycleTitle: orderCycles.title,
      pickupDate: orderCycles.pickupDate,
      pickupEndTime: orderCycles.pickupEndTime,
      pickup2Date: orderCycles.pickup2Date,
      pickup2EndTime: orderCycles.pickup2EndTime,
      supplierName: suppliers.name,
    })
    .from(orderCycles)
    .innerJoin(orders, eq(orders.cycleId, orderCycles.cycleId))
    .leftJoin(suppliers, eq(orderCycles.supplierId, suppliers.supplierId))
    .where(eq(orders.memberId, memberId));

  const now = new Date();
  // Flatten each cycle into up-to-two candidate pickups, then pick the
  // earliest one that is still in the future.
  const candidates: NextPickup[] = [];
  for (const r of rows) {
    if (r.pickupDate && r.pickupDate >= now) {
      candidates.push({
        cycleId: r.cycleId,
        cycleTitle: r.cycleTitle,
        pickupDate: r.pickupDate,
        pickupEndTime: r.pickupEndTime,
        supplierName: r.supplierName,
        isSecondPickup: false,
      });
    }
    if (r.pickup2Date && r.pickup2Date >= now) {
      candidates.push({
        cycleId: r.cycleId,
        cycleTitle: r.cycleTitle,
        pickupDate: r.pickup2Date,
        pickupEndTime: r.pickup2EndTime,
        supplierName: r.supplierName,
        isSecondPickup: true,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.pickupDate.getTime() - b.pickupDate.getTime());
  return candidates[0];
}

// Returns the order lines from the most recent cycle (excluding the
// supplied currentCycleId) where the member ordered something. Each line
// is matched by product identity (name/variant/format/unit) against the
// current cycle's products so the caller can prefill the order form even
// if the productId differs (products are recreated per-cycle).
//
// Quantities are returned as { productId: quantity } where productId
// refers to the *current* cycle's product. Products from the past order
// that are no longer offered in this cycle are silently skipped.
export async function getLastMemberOrderForPrefill(
  memberId: string,
  currentCycleId: string,
): Promise<{ cycleTitle: string; quantities: Record<string, number> }> {
  const db = getDb();

  // Find the most recent cycle (by createdAt) where this member has at
  // least one order line, excluding the current cycle.
  const [recent] = await db
    .select({
      cycleId: orders.cycleId,
      cycleTitle: orderCycles.title,
      cycleCreatedAt: orderCycles.createdAt,
    })
    .from(orders)
    .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
    .where(and(eq(orders.memberId, memberId), sql`${orders.cycleId} <> ${currentCycleId}`))
    .orderBy(desc(orderCycles.createdAt))
    .limit(1);

  if (!recent) return { cycleTitle: "", quantities: {} };

  // Pull the past order lines joined with their product metadata.
  const pastLines = await db
    .select({
      quantity: orders.quantity,
      name: products.name,
      variant: products.variant,
      format: products.format,
      unit: products.unit,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.productId))
    .where(and(eq(orders.memberId, memberId), eq(orders.cycleId, recent.cycleId)));

  // Pull the current cycle's products to map by identity.
  const currentProducts = await db
    .select({
      productId: products.productId,
      name: products.name,
      variant: products.variant,
      format: products.format,
      unit: products.unit,
    })
    .from(products)
    .where(and(eq(products.cycleId, currentCycleId), eq(products.active, true)));

  const key = (p: { name: string; variant: string | null; format: string | null; unit: string | null }) =>
    `${p.name.toLowerCase().trim()}|${(p.variant ?? "").toLowerCase().trim()}|${(p.format ?? "").toLowerCase().trim()}|${(p.unit ?? "").toLowerCase().trim()}`;

  const currentByKey = new Map(currentProducts.map((p) => [key(p), p.productId]));

  const quantities: Record<string, number> = {};
  for (const line of pastLines) {
    const productId = currentByKey.get(key(line));
    if (productId) quantities[productId] = line.quantity;
  }

  return { cycleTitle: recent.cycleTitle, quantities };
}

// The member's movements, newest first, with what the Storico detail shows:
// the cycle title, the online payment's status and the name of whoever
// recorded the row. created_by holds an admin's email: only the name leaves
// this function, through a scalar subquery, so an old email/alias clash can
// never duplicate a movement.
export async function getMemberLedger(memberId: string | string[], limit = 50) {
  const ids = Array.isArray(memberId) ? memberId : [memberId];
  const db = getDb();
  return db
    .select({
      entryId: ledgerEntries.entryId,
      type: ledgerEntries.type,
      amount: ledgerEntries.amount,
      note: ledgerEntries.note,
      entryDate: ledgerEntries.entryDate,
      cycleId: ledgerEntries.cycleId,
      paymentId: ledgerEntries.paymentId,
      method: ledgerEntries.method,
      externalRef: ledgerEntries.externalRef,
      // Set on a movement that corrects another: when it was corrected.
      correctedAt: sql<Date | null>`case when ${ledgerEntries.replaces} is not null then ${ledgerEntries.createdAt} end`,
      cycleTitle: orderCycles.title,
      paymentStatus: payments.status,
      recorderName: sql<string | null>`(
        SELECT m.full_name FROM members m
        WHERE lower(m.email) = lower(${ledgerEntries.createdBy})
           OR lower(m.alias_email) = lower(${ledgerEntries.createdBy})
        LIMIT 1
      )`,
    })
    .from(ledgerEntries)
    .leftJoin(orderCycles, eq(orderCycles.cycleId, ledgerEntries.cycleId))
    .leftJoin(payments, eq(payments.paymentId, ledgerEntries.paymentId))
    // A corrected movement shows once, as its replacement; a cancelled one
    // and the reversals not at all (their sum is zero).
    .where(and(inArray(ledgerEntries.memberId, ids), liveLedger))
    .orderBy(desc(ledgerEntries.entryDate))
    .limit(limit);
}

// Several ids: a family's account and the people who joined it.
export async function getMemberStorico(memberId: string | string[]): Promise<CycleHistoryEntry[]> {
  const db = getDb();
  const ids = Array.isArray(memberId) ? memberId : [memberId];
  const cycle = {
    cycleId: orderCycles.cycleId,
    cycleTitle: orderCycles.title,
    pickupDate: orderCycles.pickupDate,
    cycleStatus: orderCycles.status,
    cycleCreatedAt: orderCycles.createdAt,
    paymentMode: orderCycles.paymentMode,
  };
  const [lineRows, ledgerRows] = await Promise.all([
    db
      .select({
        ...cycle,
        productName: products.name,
        variant: products.variant,
        quantity: orders.quantity,
        unitPrice: orders.unitPriceSnapshot,
        lineTotal: orders.lineTotal,
        actualQuantity: orders.actualQuantity,
        actualLineTotal: orders.actualLineTotal,
        unit: products.unit,
        supplierName: suppliers.name,
        productSupplier: products.supplier,
        category: products.category,
        emoji: products.emoji,
      })
      .from(orders)
      .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
      .innerJoin(products, eq(orders.productId, products.productId))
      .leftJoin(suppliers, eq(products.supplierId, suppliers.supplierId))
      .where(inArray(orders.memberId, ids))
      .orderBy(desc(orderCycles.createdAt), asc(products.sortOrder)),
    // What the ledger moved on each cycle, so the tab adds up to the balance.
    db
      .select({
        ...cycle,
        net: sql<string>`sum(${ledgerEntries.amount})`,
        shipping: sql<string>`-coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.type} = 'shipping_charge' and ${ledgerEntries.reversedBy} is null), 0)`,
        handling: sql<string>`-coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.type} = 'handling_charge' and ${ledgerEntries.reversedBy} is null), 0)`,
        paid: sql<string>`coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.type} in ('order_payment', 'balance_payment') and ${ledgerEntries.reversedBy} is null), 0)`,
        refunded: sql<string>`-coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.type} in ('order_refund', 'refund_failed') and ${ledgerEntries.reversedBy} is null), 0)`,
      })
      .from(ledgerEntries)
      .innerJoin(orderCycles, eq(ledgerEntries.cycleId, orderCycles.cycleId))
      .where(inArray(ledgerEntries.memberId, ids))
      .groupBy(
        orderCycles.cycleId,
        orderCycles.title,
        orderCycles.pickupDate,
        orderCycles.status,
        orderCycles.createdAt,
        orderCycles.paymentMode,
      ),
  ]);
  return buildCycleHistory(lineRows, ledgerRows);
}

export type NotificationItem = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

// Whose notifications a session reads: the account's, plus the signed-in
// person's own when they joined a family (admin notifications are personal).
export function notificationOwners(memberId: string, personId?: string | null): string[] {
  return personId && personId !== memberId ? [memberId, personId] : [memberId];
}

export async function getMemberNotifications(memberIds: string[], limit = 6): Promise<NotificationItem[]> {
  const db = getDb();
  try {
    return await db
      .select({
        notificationId: notifications.notificationId,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(inArray(notifications.memberId, memberIds))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("Error fetching member notifications:", error);
    return [];
  }
}

// Raw stored preference rows for a member. Absent categories fall back to the
// code defaults (see lib/notifications/categories.ts → resolvePreferences), so
// this returns only the rows the member has explicitly changed.
export async function getNotificationPreferences(
  memberId: string,
): Promise<{ category: string; appEnabled: boolean; emailEnabled: boolean }[]> {
  const db = getDb();
  try {
    return await db
      .select({
        category: notificationPreferences.category,
        appEnabled: notificationPreferences.appEnabled,
        emailEnabled: notificationPreferences.emailEnabled,
      })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.memberId, memberId));
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return [];
  }
}

export async function getUnreadNotificationCount(memberIds: string[]): Promise<number> {
  const db = getDb();
  try {
    const [row] = await db
      .select({ count: sql<string>`count(*)` })
      .from(notifications)
      .where(and(inArray(notifications.memberId, memberIds), isNull(notifications.readAt)));
    return parseInt(row?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

// ── Admin queries ─────────────────────────────────────────────────────────────

export async function getAllCycles(limit = 30) {
  const db = getDb();
  return db
    .select({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      status: orderCycles.status,
      accessLevel: orderCycles.accessLevel,
      pickupDate: orderCycles.pickupDate,
      pickupEndTime: orderCycles.pickupEndTime,
      pickup2Date: orderCycles.pickup2Date,
      pickup2EndTime: orderCycles.pickup2EndTime,
      orderCloseAt: orderCycles.orderCloseAt,
      orderOpenAt: orderCycles.orderOpenAt,
      createdAt: orderCycles.createdAt,
      closedAt: orderCycles.closedAt,
      supplierId: orderCycles.supplierId,
      supplierName: suppliers.name,
      supplierEmail: suppliers.email,
      notes: orderCycles.notes,
      shippingMode: orderCycles.shippingMode,
      shippingCostPerMember: orderCycles.shippingCostPerMember,
      shippingTotal: orderCycles.shippingTotal,
      paymentMode: orderCycles.paymentMode,
      handlingFeeType: orderCycles.handlingFeeType,
      handlingFeeValue: orderCycles.handlingFeeValue,
      settledAt: orderCycles.settledAt,
    })
    .from(orderCycles)
    .leftJoin(suppliers, eq(orderCycles.supplierId, suppliers.supplierId))
    .orderBy(desc(orderCycles.createdAt))
    .limit(limit);
}

export async function getOpenCycleStats(cycleId: string) {
  const db = getDb();
  const [result] = await db
    .select({
      orderCount: sql<string>`count(distinct ${orders.memberId})`,
      grandTotal: sql<string>`coalesce(sum(${orders.lineTotal}), '0')`,
    })
    .from(orders)
    .where(eq(orders.cycleId, cycleId));
  // Pay-per-order: drafts nobody paid stay out of the order at the close, and
  // a Checkout still open may complete after it (then it is refunded).
  const { rows } = await db.execute<{ drafts: number; pending: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM order_drafts WHERE cycle_id = ${cycleId}) AS drafts,
      (SELECT count(*)::int FROM payments WHERE cycle_id = ${cycleId} AND kind = 'order' AND status = 'pending') AS pending
  `);
  return {
    orderCount: parseInt(result?.orderCount ?? "0"),
    grandTotal: parseFloat(result?.grandTotal ?? "0"),
    unpaidDrafts: rows[0]?.drafts ?? 0,
    pendingPayments: rows[0]?.pending ?? 0,
  };
}

export async function getAllSuppliers() {
  const db = getDb();
  return db
    .select()
    .from(suppliers)
    .where(eq(suppliers.active, true))
    .orderBy(asc(suppliers.name));
}

export async function getAllMembers() {
  const db = getDb();
  return db.select().from(members).orderBy(asc(members.fullName));
}

// Possible duplicate pairs an admin dismissed, as "member_a:member_b"
// (lib/members/duplicates.ts pairKey).
export async function getDismissedDuplicatePairs(): Promise<Set<string>> {
  const rows = await getDb()
    .select({ a: memberDuplicateDismissals.memberA, b: memberDuplicateDismissals.memberB })
    .from(memberDuplicateDismissals);
  return new Set(rows.map((r) => `${r.a}:${r.b}`));
}

export type MemberWithBalance = {
  memberId: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
  // Joined another account as family: its member id.
  householdOf: string | null;
  balance: number;
};

export async function getAllMembersWithBalances(): Promise<MemberWithBalance[]> {
  const db = getDb();
  const [memberList, balances] = await Promise.all([
    db.select().from(members).orderBy(asc(members.fullName)),
    db
      .select({
        memberId: ledgerEntries.memberId,
        total: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')`,
      })
      .from(ledgerEntries)
      .groupBy(ledgerEntries.memberId),
  ]);
  const balanceMap = new Map(balances.map((b) => [b.memberId, parseFloat(b.total)]));
  return memberList.map((m) => ({
    memberId: m.memberId,
    fullName: m.fullName,
    email: m.email,
    role: m.role,
    active: m.active,
    householdOf: m.householdOf,
    balance: balanceMap.get(m.memberId) ?? 0,
  }));
}

export type CycleSummary = {
  byProduct: {
    productId: string;
    name: string;
    variant: string | null;
    unit: string | null;
    totalQty: number;
    totalAmount: number;
  }[];
  byMember: {
    memberId: string;
    fullName: string;
    productsTotal: number;
    shipping: number;
    total: number;
    lines: {
      productName: string;
      variant: string | null;
      quantity: number;
      lineTotal: number;
      adjusted: boolean;
    }[];
  }[];
  productsTotal: number;
  shippingTotal: number;
  grandTotal: number;
  orderCount: number;
};

export async function getAdminCycleSummary(cycleId: string): Promise<CycleSummary> {
  const db = getDb();
  const [rows, shippingRows] = await Promise.all([
    db
      .select({
        memberId: orders.memberId,
        memberName: members.fullName,
        productId: products.productId,
        productName: products.name,
        variant: products.variant,
        unit: products.unit,
        quantity: orders.quantity,
        lineTotal: orders.lineTotal,
        actualQuantity: orders.actualQuantity,
        actualLineTotal: orders.actualLineTotal,
      })
      .from(orders)
      .innerJoin(members, eq(orders.memberId, members.memberId))
      .innerJoin(products, eq(orders.productId, products.productId))
      .where(eq(orders.cycleId, cycleId))
      .orderBy(asc(products.sortOrder), asc(members.fullName)),
    db
      .select({
        memberId: ledgerEntries.memberId,
        amount: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')`,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.cycleId, cycleId),
          eq(ledgerEntries.type, "shipping_charge"),
          liveLedger,
        ),
      )
      .groupBy(ledgerEntries.memberId),
  ]);

  // Shipping is recorded as a negative ledger entry (a charge); we report it
  // as a positive cost so it adds up cleanly with the product spend.
  const shippingByMember = new Map<string, number>();
  for (const r of shippingRows) {
    shippingByMember.set(r.memberId, Math.abs(parseFloat(r.amount)));
  }

  const productMap = new Map<string, CycleSummary["byProduct"][number]>();
  const memberMap = new Map<string, CycleSummary["byMember"][number]>();

  for (const row of rows) {
    const effective =
      row.actualLineTotal != null
        ? parseFloat(row.actualLineTotal)
        : parseFloat(row.lineTotal);
    const adjusted = row.actualLineTotal != null || row.actualQuantity != null;

    if (!productMap.has(row.productId)) {
      productMap.set(row.productId, {
        productId: row.productId,
        name: row.productName,
        variant: row.variant,
        unit: row.unit,
        totalQty: 0,
        totalAmount: 0,
      });
    }
    productMap.get(row.productId)!.totalQty += row.quantity;
    productMap.get(row.productId)!.totalAmount += effective;

    if (!memberMap.has(row.memberId)) {
      memberMap.set(row.memberId, {
        memberId: row.memberId,
        fullName: row.memberName,
        productsTotal: 0,
        shipping: 0,
        total: 0,
        lines: [],
      });
    }
    const m = memberMap.get(row.memberId)!;
    m.productsTotal += effective;
    m.lines.push({
      productName: row.productName,
      variant: row.variant,
      quantity: row.quantity,
      lineTotal: effective,
      adjusted,
    });
  }

  // Attach shipping to every member who has it (even if they had no order
  // lines — unlikely but possible after an admin edit).
  for (const [mid, amount] of shippingByMember) {
    if (!memberMap.has(mid)) {
      const [m] = await db
        .select({ fullName: members.fullName })
        .from(members)
        .where(eq(members.memberId, mid));
      memberMap.set(mid, {
        memberId: mid,
        fullName: m?.fullName ?? "—",
        productsTotal: 0,
        shipping: 0,
        total: 0,
        lines: [],
      });
    }
    const entry = memberMap.get(mid)!;
    entry.shipping = amount;
  }

  for (const m of memberMap.values()) {
    m.total = m.productsTotal + m.shipping;
  }

  const byMember = Array.from(memberMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
  const productsTotal = byMember.reduce((s, m) => s + m.productsTotal, 0);
  const shippingTotal = byMember.reduce((s, m) => s + m.shipping, 0);
  return {
    byProduct: Array.from(productMap.values()),
    byMember,
    productsTotal,
    shippingTotal,
    grandTotal: productsTotal + shippingTotal,
    orderCount: byMember.length,
  };
}

// Returns each product in the cycle with the total quantity ordered and the
// total ordered amount at the current snapshot price. Used by the
// "close with adjustments" modal so the admin can see how much was ordered
// per product and decide a corrected unit price (e.g. for weight-based items
// where actual weight differs from ordered quantity). Products with zero
// orders are included so the admin can still adjust prices that nobody
// happened to order this round.
export type CycleProductForReview = {
  productId: string;
  name: string;
  variant: string | null;
  format: string | null;
  unit: string | null;
  emoji: string | null;
  unitPrice: number;
  totalQty: number;
  totalAmount: number;
};

export async function getCycleProductsForReview(
  cycleId: string,
): Promise<CycleProductForReview[]> {
  const db = getDb();
  const rows = await db
    .select({
      productId: products.productId,
      name: products.name,
      variant: products.variant,
      format: products.format,
      unit: products.unit,
      emoji: products.emoji,
      unitPrice: products.unitPrice,
      totalQty: sql<string>`coalesce(sum(${orders.quantity}), 0)`,
      totalAmount: sql<string>`coalesce(sum(${orders.lineTotal}), '0')`,
    })
    .from(products)
    .leftJoin(orders, and(eq(orders.productId, products.productId), eq(orders.cycleId, cycleId)))
    .where(eq(products.cycleId, cycleId))
    .groupBy(
      products.productId,
      products.name,
      products.variant,
      products.format,
      products.unit,
      products.emoji,
      products.unitPrice,
      products.sortOrder,
    )
    .orderBy(asc(products.sortOrder), asc(products.name));

  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    variant: r.variant,
    format: r.format,
    unit: r.unit,
    emoji: r.emoji,
    unitPrice: parseFloat(r.unitPrice),
    totalQty: parseInt(r.totalQty as string) || 0,
    totalAmount: parseFloat(r.totalAmount as string) || 0,
  }));
}

export async function getAdminCycleProducts(cycleId: string) {
  const db = getDb();
  return db
    .select({
      productId: products.productId,
      name: products.name,
      variant: products.variant,
      format: products.format,
      unitPrice: products.unitPrice,
      unit: products.unit,
      supplierName: suppliers.name,
      supplierId: products.supplierId,
      sortOrder: products.sortOrder,
    })
    .from(products)
    .leftJoin(suppliers, eq(products.supplierId, suppliers.supplierId))
    .where(eq(products.cycleId, cycleId))
    .orderBy(asc(suppliers.name), asc(products.name));
}

export type MemberOrderHistory = {
  cycleId: string;
  cycleTitle: string;
  pickupDate: string | null;
  cycleStatus: string;
  total: number;
  lines: { productName: string; variant: string | null; quantity: number; lineTotal: number }[];
};

export async function getAdminMemberOrders(memberId: string): Promise<MemberOrderHistory[]> {
  const db = getDb();
  const rows = await db
    .select({
      cycleId: orderCycles.cycleId,
      cycleTitle: orderCycles.title,
      pickupDate: orderCycles.pickupDate,
      cycleStatus: orderCycles.status,
      productName: products.name,
      variant: products.variant,
      quantity: orders.quantity,
      lineTotal: orders.lineTotal,
      sortOrder: products.sortOrder,
    })
    .from(orders)
    .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
    .innerJoin(products, eq(orders.productId, products.productId))
    .where(eq(orders.memberId, memberId))
    .orderBy(desc(orderCycles.createdAt), asc(products.sortOrder));

  const cycleMap = new Map<string, MemberOrderHistory>();
  for (const row of rows) {
    if (!cycleMap.has(row.cycleId)) {
      cycleMap.set(row.cycleId, {
        cycleId: row.cycleId,
        cycleTitle: row.cycleTitle,
        pickupDate: row.pickupDate?.toISOString() ?? null,
        cycleStatus: row.cycleStatus,
        total: 0,
        lines: [],
      });
    }
    const entry = cycleMap.get(row.cycleId)!;
    entry.total += parseFloat(row.lineTotal);
    entry.lines.push({
      productName: row.productName,
      variant: row.variant,
      quantity: row.quantity,
      lineTotal: parseFloat(row.lineTotal),
    });
  }
  return Array.from(cycleMap.values());
}

// ── Fornitori admin ───────────────────────────────────────────────────────────

export async function getAllSuppliersAdmin() {
  const db = getDb();
  const rows = await db
    .select({
      supplierId: suppliers.supplierId,
      name: suppliers.name,
      macroCategory: suppliers.macroCategory,
      contactName: suppliers.contactName,
      phone: suppliers.phone,
      email: suppliers.email,
      address: suppliers.address,
      notes: suppliers.notes,
      active: suppliers.active,
      cycleCount: sql<string>`count(distinct ${orderCycles.cycleId})`,
    })
    .from(suppliers)
    .leftJoin(orderCycles, eq(suppliers.supplierId, orderCycles.supplierId))
    .groupBy(suppliers.supplierId)
    .orderBy(asc(suppliers.name));
  return rows.map((r) => ({ ...r, cycleCount: parseInt(r.cycleCount) }));
}

export type CatalogProductItem = {
  catalogProductId: string;
  supplierId: string;
  name: string;
  variant: string | null;
  format: string | null;
  unit: string | null;
  unitPrice: string;
  pricePerKg: string | null;
  notes: string | null;
  category: string | null;
  emoji: string | null;
  active: boolean;
  createdAt: Date;
  archivedAt: Date | null;
};

export async function getCatalogBySupplier(supplierId: string, includeArchived = false) {
  const db = getDb();
  if (includeArchived) {
    return db.select().from(supplierProducts).where(eq(supplierProducts.supplierId, supplierId)).orderBy(asc(supplierProducts.name));
  } else {
    return db.select().from(supplierProducts).where(and(eq(supplierProducts.supplierId, supplierId), eq(supplierProducts.active, true))).orderBy(asc(supplierProducts.name));
  }
}

export async function getAllCatalogProducts(): Promise<Record<string, CatalogProductItem[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(supplierProducts)
    .orderBy(asc(supplierProducts.name));

  const result: Record<string, CatalogProductItem[]> = {};
  for (const row of rows) {
    if (!result[row.supplierId]) result[row.supplierId] = [];
    result[row.supplierId].push(row);
  }
  return result;
}

// ── Cassa inline ──────────────────────────────────────────────────────────────

export type LedgerEntryItem = {
  entryId: string;
  entryDate: string | null;
  type: string;
  amount: string;
  note: string | null;
  cycleTitle: string | null;
  paymentId: string | null;
  method: string | null;
  externalRef: string | null;
  // When this movement replaced a corrected one (append-only ledger).
  correctedAt: string | null;
};

export async function getAllMembersLedger(): Promise<Record<string, LedgerEntryItem[]>> {
  const db = getDb();
  const rows = await db
    .select({
      memberId: ledgerEntries.memberId,
      entryId: ledgerEntries.entryId,
      entryDate: ledgerEntries.entryDate,
      type: ledgerEntries.type,
      amount: ledgerEntries.amount,
      note: ledgerEntries.note,
      cycleTitle: orderCycles.title,
      paymentId: ledgerEntries.paymentId,
      method: ledgerEntries.method,
      externalRef: ledgerEntries.externalRef,
      replaces: ledgerEntries.replaces,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .leftJoin(orderCycles, eq(ledgerEntries.cycleId, orderCycles.cycleId))
    .where(liveLedger)
    .orderBy(desc(ledgerEntries.entryDate), desc(ledgerEntries.createdAt));

  const result: Record<string, LedgerEntryItem[]> = {};
  for (const row of rows) {
    if (!result[row.memberId]) result[row.memberId] = [];
    result[row.memberId].push({
      entryId: row.entryId,
      entryDate: row.entryDate?.toISOString() ?? null,
      type: row.type,
      amount: row.amount,
      note: row.note,
      cycleTitle: row.cycleTitle ?? null,
      paymentId: row.paymentId ?? null,
      method: row.method ?? null,
      externalRef: row.externalRef ?? null,
      correctedAt: row.replaces ? row.createdAt.toISOString() : null,
    });
  }
  return result;
}

// ── Admin home insights ──────────────────────────────────────────────────────
// Quick at-a-glance metrics surfaced at the top of the admin "Ciclo" tab.
// Each one is fast (single small aggregate) so the row stays cheap even on
// every admin page load.

export type AdminInsights = {
  // Open cycles right now. Surface = "what's live for members".
  openCyclesCount: number;
  // Open cycles closing within the next 7 days. Surface = "imminent deadlines".
  closingSoonCount: number;
  // Cycles closed in the last 7 days. Surface = "recently wrapped up".
  recentlyClosedCount: number;
};

export async function getAdminInsights(): Promise<AdminInsights> {
  const db = getDb();

  const [openRows, closingSoonRows, recentlyClosedRows] = await Promise.all([
    db
      .select({ cycleId: orderCycles.cycleId })
      .from(orderCycles)
      .where(eq(orderCycles.status, "open")),
    db
      .select({ cycleId: orderCycles.cycleId })
      .from(orderCycles)
      .where(
        and(
          eq(orderCycles.status, "open"),
          isNotNull(orderCycles.orderCloseAt),
          sql`${orderCycles.orderCloseAt} <= now() + interval '7 days'`,
          sql`${orderCycles.orderCloseAt} > now()`,
        ),
      ),
    db
      .select({ cycleId: orderCycles.cycleId })
      .from(orderCycles)
      .where(
        and(
          eq(orderCycles.status, "closed"),
          isNotNull(orderCycles.closedAt),
          sql`${orderCycles.closedAt} >= now() - interval '7 days'`,
        ),
      ),
  ]);

  return {
    openCyclesCount: openRows.length,
    closingSoonCount: closingSoonRows.length,
    recentlyClosedCount: recentlyClosedRows.length,
  };
}

// ── Analytics ────────────────────────────────────────────────────────────────
// Aggregations used by the admin "Statistiche" tab. They all operate over
// closed cycles only (status = 'closed') because that's when the data is
// final — orders in open cycles can still change.

export type AnalyticsOverview = {
  closedCycles: number;
  totalRevenue: number;
  activeMembers: number; // members with at least one order in the last N cycles
  topProductName: string | null;
  topProductQty: number;
};

export type ProductRanking = {
  name: string;
  variant: string | null;
  unit: string | null;
  emoji: string | null;
  totalQty: number;
  totalAmount: number;
  cyclesCount: number;
};

export type CycleRevenuePoint = {
  cycleId: string;
  title: string;
  closedAt: string | null;
  pickupDate: string | null;
  total: number;
  orderCount: number;
};

export type MemberParticipation = {
  memberId: string;
  fullName: string;
  cyclesOrdered: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

export type SupplierStat = {
  supplierId: string;
  name: string;
  cyclesCount: number;
  totalRevenue: number;
  topProductName: string | null;
};

const ACTIVE_LOOKBACK_CYCLES = 3;

// Filters reused across the analytics dashboard. Each list is optional and
// applied as an additional AND clause; passing none yields the unfiltered
// rollup over all closed cycles. Empty arrays are treated the same as
// undefined (no filter), so callers can pass [] safely.
export type AnalyticsFilters = {
  cycleIds?: string[];
  supplierIds?: string[];
  memberIds?: string[];
};

function nonEmpty<T>(arr: T[] | undefined): arr is T[] {
  return Array.isArray(arr) && arr.length > 0;
}

// Effective per-line amount: use the actual delivered total when the admin
// recorded a weight/price rectification, otherwise the ordered total.
const effectiveLineTotal = sql<string>`coalesce(${orders.actualLineTotal}, ${orders.lineTotal})`;

function orderScopeWhere(f: AnalyticsFilters | undefined) {
  const clauses = [eq(orderCycles.status, "closed")];
  if (nonEmpty(f?.cycleIds)) clauses.push(inArray(orders.cycleId, f!.cycleIds!));
  if (nonEmpty(f?.supplierIds)) clauses.push(inArray(products.supplierId, f!.supplierIds!));
  if (nonEmpty(f?.memberIds)) clauses.push(inArray(orders.memberId, f!.memberIds!));
  return and(...clauses);
}

export async function getAnalyticsOverview(
  filters?: AnalyticsFilters,
): Promise<AnalyticsOverview> {
  const db = getDb();

  // Closed cycles that match the filters. We count via DISTINCT over the
  // orders table so member/supplier filters narrow the count, then cross-
  // check against the orderCycles table to honor a cycleId filter even
  // when it has no orders.
  const cycleCountRows = await db
    .select({ cycleId: sql<string>`distinct ${orders.cycleId}` })
    .from(orders)
    .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
    .innerJoin(products, eq(orders.productId, products.productId))
    .where(orderScopeWhere(filters));
  let closedCycles = cycleCountRows.length;
  if (nonEmpty(filters?.cycleIds) && closedCycles === 0) {
    const [exists] = await db
      .select({ n: sql<string>`count(*)` })
      .from(orderCycles)
      .where(and(eq(orderCycles.status, "closed"), inArray(orderCycles.cycleId, filters!.cycleIds!)));
    closedCycles = parseInt(exists?.n ?? "0");
  }

  const [revenueRow, shippingRow] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(${effectiveLineTotal}), '0')` })
      .from(orders)
      .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
      .innerJoin(products, eq(orders.productId, products.productId))
      .where(orderScopeWhere(filters))
      .then((r) => r[0]),
    db
      .select({ total: sql<string>`coalesce(sum(abs(${ledgerEntries.amount})), '0')` })
      .from(ledgerEntries)
      .innerJoin(orderCycles, eq(ledgerEntries.cycleId, orderCycles.cycleId))
      .where(
        and(
          eq(orderCycles.status, "closed"),
          eq(ledgerEntries.type, "shipping_charge"),
          liveLedger,
          ...(nonEmpty(filters?.cycleIds) ? [inArray(ledgerEntries.cycleId, filters!.cycleIds!)] : []),
          ...(nonEmpty(filters?.memberIds) ? [inArray(ledgerEntries.memberId, filters!.memberIds!)] : []),
          ...(nonEmpty(filters?.supplierIds) ? [inArray(orderCycles.supplierId, filters!.supplierIds!)] : []),
        ),
      )
      .then((r) => r[0]),
  ]);

  // Active members: distinct memberIds with at least one order in the
  // ACTIVE_LOOKBACK_CYCLES most recently closed cycles that match the
  // current filters.
  const recentCycles = await db
    .select({ cycleId: orderCycles.cycleId })
    .from(orderCycles)
    .where(
      and(
        eq(orderCycles.status, "closed"),
        ...(nonEmpty(filters?.cycleIds) ? [inArray(orderCycles.cycleId, filters!.cycleIds!)] : []),
        ...(nonEmpty(filters?.supplierIds) ? [inArray(orderCycles.supplierId, filters!.supplierIds!)] : []),
      ),
    )
    .orderBy(desc(orderCycles.closedAt))
    .limit(ACTIVE_LOOKBACK_CYCLES);

  const recentCycleIds = recentCycles.map((c) => c.cycleId);
  let activeMembers = 0;
  if (recentCycleIds.length > 0) {
    const [activeRow] = await db
      .select({ n: sql<string>`count(distinct ${orders.memberId})` })
      .from(orders)
      .where(
        and(
          inArray(orders.cycleId, recentCycleIds),
          ...(nonEmpty(filters?.memberIds) ? [inArray(orders.memberId, filters!.memberIds!)] : []),
        ),
      );
    activeMembers = parseInt(activeRow?.n ?? "0");
  }

  const [topProduct] = await db
    .select({
      name: products.name,
      totalQty: sql<string>`sum(${orders.quantity})`,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.productId))
    .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
    .where(orderScopeWhere(filters))
    .groupBy(products.name)
    .orderBy(sql`sum(${orders.quantity}) desc`)
    .limit(1);

  return {
    closedCycles,
    totalRevenue:
      parseFloat(revenueRow?.total ?? "0") + parseFloat(shippingRow?.total ?? "0"),
    activeMembers,
    topProductName: topProduct?.name ?? null,
    topProductQty: topProduct ? parseInt(topProduct.totalQty as string) : 0,
  };
}

export async function getProductRankings(
  limit = 10,
  filters?: AnalyticsFilters,
): Promise<ProductRanking[]> {
  const db = getDb();
  const rows = await db
    .select({
      name: products.name,
      variant: products.variant,
      unit: products.unit,
      emoji: products.emoji,
      totalQty: sql<string>`sum(${orders.quantity})`,
      totalAmount: sql<string>`sum(${effectiveLineTotal})`,
      cyclesCount: sql<string>`count(distinct ${orders.cycleId})`,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.productId))
    .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
    .where(orderScopeWhere(filters))
    .groupBy(products.name, products.variant, products.unit, products.emoji)
    .orderBy(sql`sum(${orders.quantity}) desc`)
    .limit(limit);

  return rows.map((r) => ({
    name: r.name,
    variant: r.variant,
    unit: r.unit,
    emoji: r.emoji,
    totalQty: parseInt(r.totalQty as string) || 0,
    totalAmount: parseFloat(r.totalAmount as string) || 0,
    cyclesCount: parseInt(r.cyclesCount as string) || 0,
  }));
}

export async function getCycleRevenueTrend(
  limit = 12,
  filters?: AnalyticsFilters,
): Promise<CycleRevenuePoint[]> {
  const db = getDb();
  // Per-cycle products spend. We join through products so the supplier
  // filter applies to product rows, not the cycle-level supplier — keeps
  // the chart consistent with the other cards.
  const productRows = await db
    .select({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      closedAt: orderCycles.closedAt,
      pickupDate: orderCycles.pickupDate,
      total: sql<string>`coalesce(sum(${effectiveLineTotal}), '0')`,
      orderCount: sql<string>`count(distinct ${orders.memberId})`,
    })
    .from(orderCycles)
    .leftJoin(orders, eq(orders.cycleId, orderCycles.cycleId))
    .leftJoin(products, eq(orders.productId, products.productId))
    .where(
      and(
        eq(orderCycles.status, "closed"),
        ...(nonEmpty(filters?.cycleIds) ? [inArray(orderCycles.cycleId, filters!.cycleIds!)] : []),
        ...(nonEmpty(filters?.supplierIds)
          ? [
              or(
                isNull(products.supplierId),
                inArray(products.supplierId, filters!.supplierIds!),
              )!,
            ]
          : []),
        ...(nonEmpty(filters?.memberIds)
          ? [or(isNull(orders.memberId), inArray(orders.memberId, filters!.memberIds!))!]
          : []),
      ),
    )
    .groupBy(orderCycles.cycleId, orderCycles.title, orderCycles.closedAt, orderCycles.pickupDate)
    .orderBy(desc(orderCycles.closedAt))
    .limit(limit);

  // Shipping spend per cycle, scoped by the same filters.
  const shippingRows = await db
    .select({
      cycleId: ledgerEntries.cycleId,
      total: sql<string>`coalesce(sum(abs(${ledgerEntries.amount})), '0')`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.type, "shipping_charge"),
        liveLedger,
        ...(nonEmpty(filters?.cycleIds) ? [inArray(ledgerEntries.cycleId, filters!.cycleIds!)] : []),
        ...(nonEmpty(filters?.memberIds) ? [inArray(ledgerEntries.memberId, filters!.memberIds!)] : []),
      ),
    )
    .groupBy(ledgerEntries.cycleId);
  const shippingByCycle = new Map(
    shippingRows.map((r) => [r.cycleId ?? "", parseFloat(r.total)]),
  );

  return productRows
    .map((r) => ({
      cycleId: r.cycleId,
      title: r.title,
      closedAt: r.closedAt?.toISOString() ?? null,
      pickupDate: r.pickupDate?.toISOString() ?? null,
      total: parseFloat(r.total) + (shippingByCycle.get(r.cycleId) ?? 0),
      orderCount: parseInt(r.orderCount as string) || 0,
    }))
    .reverse();
}

export async function getMemberParticipation(
  filters?: AnalyticsFilters,
): Promise<MemberParticipation[]> {
  const db = getDb();
  // Build the closed-cycle scope for the order subquery so the supplier/
  // cycle filters narrow what counts as "participation".
  // Embed drizzle's inArray() inside the raw subquery template — using
  // Postgres `= ANY($1::text[])` would require the driver to round-trip
  // the JS array as a text[] which the Neon HTTP driver does NOT do (it
  // sends each parameter as text). `inArray()` instead expands to
  // `IN ($1, $2, ...)` with one placeholder per element, which works.
  const memberOrderJoin = and(
    eq(orders.memberId, members.memberId),
    sql`${orders.cycleId} in (
      select ${orderCycles.cycleId} from ${orderCycles}
      where ${orderCycles.status} = 'closed'
      ${nonEmpty(filters?.cycleIds) ? sql`and ${inArray(orderCycles.cycleId, filters!.cycleIds!)}` : sql``}
      ${nonEmpty(filters?.supplierIds) ? sql`and ${inArray(orderCycles.supplierId, filters!.supplierIds!)}` : sql``}
    )`,
    ...(nonEmpty(filters?.supplierIds)
      ? [
          sql`${orders.productId} in (
            select ${products.productId} from ${products}
            where ${inArray(products.supplierId, filters!.supplierIds!)}
          )`,
        ]
      : []),
  );

  const rows = await db
    .select({
      memberId: members.memberId,
      fullName: members.fullName,
      cyclesOrdered: sql<string>`count(distinct ${orders.cycleId})`,
      totalSpent: sql<string>`coalesce(sum(${effectiveLineTotal}), '0')`,
      lastOrderAt: sql<Date | null>`max(${orders.updatedAt})`,
    })
    .from(members)
    .leftJoin(orders, memberOrderJoin)
    .where(
      and(
        eq(members.active, true),
        ...(nonEmpty(filters?.memberIds) ? [inArray(members.memberId, filters!.memberIds!)] : []),
      ),
    )
    .groupBy(members.memberId, members.fullName)
    .orderBy(sql`count(distinct ${orders.cycleId}) desc`, asc(members.fullName));

  return rows.map((r) => ({
    memberId: r.memberId,
    fullName: r.fullName,
    cyclesOrdered: parseInt(r.cyclesOrdered as string) || 0,
    totalSpent: parseFloat(r.totalSpent as string) || 0,
    lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt as unknown as string).toISOString() : null,
  }));
}

export async function getSupplierStats(
  filters?: AnalyticsFilters,
): Promise<SupplierStat[]> {
  const db = getDb();
  const rows = await db
    .select({
      supplierId: suppliers.supplierId,
      name: suppliers.name,
      cyclesCount: sql<string>`count(distinct ${orderCycles.cycleId})`,
      totalRevenue: sql<string>`coalesce(sum(${effectiveLineTotal}), '0')`,
    })
    .from(suppliers)
    .leftJoin(orderCycles, eq(orderCycles.supplierId, suppliers.supplierId))
    .leftJoin(
      orders,
      and(
        eq(orders.cycleId, orderCycles.cycleId),
        eq(orderCycles.status, "closed"),
        ...(nonEmpty(filters?.cycleIds) ? [inArray(orders.cycleId, filters!.cycleIds!)] : []),
        ...(nonEmpty(filters?.memberIds) ? [inArray(orders.memberId, filters!.memberIds!)] : []),
      ),
    )
    .where(
      nonEmpty(filters?.supplierIds)
        ? inArray(suppliers.supplierId, filters!.supplierIds!)
        : sql`true`,
    )
    .groupBy(suppliers.supplierId, suppliers.name)
    .orderBy(sql`coalesce(sum(${effectiveLineTotal}), 0) desc`);

  // Top product per supplier in ONE grouped query instead of one query per
  // supplier: DISTINCT ON keeps the first row per supplier under the ORDER
  // BY, i.e. the product with the highest total quantity.
  const topRows = await db
    .selectDistinctOn([orderCycles.supplierId], {
      supplierId: orderCycles.supplierId,
      name: products.name,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.productId))
    .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
    .where(
      and(
        isNotNull(orderCycles.supplierId),
        eq(orderCycles.status, "closed"),
        ...(nonEmpty(filters?.cycleIds) ? [inArray(orders.cycleId, filters!.cycleIds!)] : []),
        ...(nonEmpty(filters?.memberIds) ? [inArray(orders.memberId, filters!.memberIds!)] : []),
      ),
    )
    .groupBy(orderCycles.supplierId, products.name)
    .orderBy(orderCycles.supplierId, sql`sum(${orders.quantity}) desc`);
  const topBySupplier = new Map(topRows.map((r) => [r.supplierId, r.name]));

  return rows.map((r) => ({
    supplierId: r.supplierId,
    name: r.name,
    cyclesCount: parseInt(r.cyclesCount as string) || 0,
    totalRevenue: parseFloat(r.totalRevenue as string) || 0,
    topProductName: topBySupplier.get(r.supplierId) ?? null,
  }));
}

// Impostazioni: the guide searches that found nothing, most frequent first,
// from the last MISS_RETENTION_DAYS (older rows are pruned on the next miss).
export async function getGuideSearchMisses(limit = 30) {
  const db = getDb();
  return db
    .select({ query: guideSearchMisses.query, count: guideSearchMisses.count, lastAt: guideSearchMisses.lastAt })
    .from(guideSearchMisses)
    .where(sql`${guideSearchMisses.lastAt} >= now() - make_interval(days => ${MISS_RETENTION_DAYS})`)
    .orderBy(desc(guideSearchMisses.count), desc(guideSearchMisses.lastAt))
    .limit(limit);
}
