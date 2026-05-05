import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import {
  ledgerEntries,
  members,
  notifications,
  orderCycles,
  orders,
  products,
  suppliers,
  supplierProducts,
} from "./schema";

export async function getMemberByEmail(email: string) {
  const db = getDb();
  const [member] = await db
    .select()
    .from(members)
    .where(or(eq(members.email, email), eq(members.aliasEmail, email)))
    .limit(1);
  return member ?? null;
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

export async function getOpenCycles(includeExpired = false) {
  const db = getDb();
  const cycles = await db
    .select()
    .from(orderCycles)
    .where(
      includeExpired
        ? eq(orderCycles.status, "open")
        : and(
            eq(orderCycles.status, "open"),
            or(isNull(orderCycles.orderCloseAt), sql`${orderCycles.orderCloseAt} > now()`),
          ),
    )
    .orderBy(asc(orderCycles.orderCloseAt));
  return cycles;
}

export async function getCycleProducts(cycleId: string) {
  const db = getDb();
  return db
    .select()
    .from(products)
    .where(and(eq(products.cycleId, cycleId), eq(products.active, true)))
    .orderBy(asc(products.sortOrder), asc(products.name));
}

export async function getMemberOrderLines(memberId: string, cycleId: string) {
  const db = getDb();
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.memberId, memberId), eq(orders.cycleId, cycleId)));
}

export async function getMemberLedger(memberId: string, limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.memberId, memberId))
    .orderBy(desc(ledgerEntries.entryDate))
    .limit(limit);
}

export type CycleHistoryEntry = {
  cycleId: string;
  title: string;
  pickupDate: Date | null;
  status: string;
  orderTotal: number;
  lines: {
    productName: string;
    variant: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    unit: string | null;
    supplierName: string | null;
    category: string | null;
    emoji: string | null;
  }[];
};

export async function getMemberStorico(memberId: string): Promise<CycleHistoryEntry[]> {
  const db = getDb();
  const rows = await db
    .select({
      cycleId: orderCycles.cycleId,
      cycleTitle: orderCycles.title,
      pickupDate: orderCycles.pickupDate,
      cycleStatus: orderCycles.status,
      cycleCreatedAt: orderCycles.createdAt,
      lineTotal: orders.lineTotal,
      quantity: orders.quantity,
      unitPrice: orders.unitPriceSnapshot,
      lineTotalAmount: orders.lineTotal,
      productName: products.name,
      variant: products.variant,
      unit: products.unit,
      supplierName: suppliers.name,
      productSupplier: products.supplier,
      category: products.category,
      emoji: products.emoji,
      sortOrder: products.sortOrder,
    })
    .from(orders)
    .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
    .innerJoin(products, eq(orders.productId, products.productId))
    .leftJoin(suppliers, eq(products.supplierId, suppliers.supplierId))
    .where(eq(orders.memberId, memberId))
    .orderBy(desc(orderCycles.createdAt), asc(products.sortOrder));

  const cycleMap = new Map<string, CycleHistoryEntry>();
  for (const row of rows) {
    if (!cycleMap.has(row.cycleId)) {
      cycleMap.set(row.cycleId, {
        cycleId: row.cycleId,
        title: row.cycleTitle,
        pickupDate: row.pickupDate,
        status: row.cycleStatus,
        orderTotal: 0,
        lines: [],
      });
    }
    const entry = cycleMap.get(row.cycleId)!;
    entry.orderTotal += parseFloat(row.lineTotal);
    entry.lines.push({
      productName: row.productName,
      variant: row.variant,
      quantity: row.quantity,
      unitPrice: parseFloat(row.unitPrice),
      lineTotal: parseFloat(row.lineTotalAmount),
      unit: row.unit,
      supplierName: row.supplierName ?? row.productSupplier,
      category: row.category,
      emoji: row.emoji,
    });
  }
  return Array.from(cycleMap.values());
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

export async function getMemberNotifications(memberId: string, limit = 6): Promise<NotificationItem[]> {
  const db = getDb();
  return db
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
    .where(eq(notifications.memberId, memberId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getAdminNotifications(limit = 6): Promise<NotificationItem[]> {
  const db = getDb();
  return db
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
    .where(eq(notifications.role, "admin"))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
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
      orderCloseAt: orderCycles.orderCloseAt,
      orderOpenAt: orderCycles.orderOpenAt,
      createdAt: orderCycles.createdAt,
      closedAt: orderCycles.closedAt,
      supplierId: orderCycles.supplierId,
      supplierName: suppliers.name,
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
  return {
    orderCount: parseInt(result?.orderCount ?? "0"),
    grandTotal: parseFloat(result?.grandTotal ?? "0"),
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

export type MemberWithBalance = {
  memberId: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
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
    total: number;
    lines: { productName: string; variant: string | null; quantity: number; lineTotal: number }[];
  }[];
  grandTotal: number;
  orderCount: number;
};

export async function getAdminCycleSummary(cycleId: string): Promise<CycleSummary> {
  const db = getDb();
  const rows = await db
    .select({
      memberId: orders.memberId,
      memberName: members.fullName,
      productId: products.productId,
      productName: products.name,
      variant: products.variant,
      unit: products.unit,
      quantity: orders.quantity,
      lineTotal: orders.lineTotal,
    })
    .from(orders)
    .innerJoin(members, eq(orders.memberId, members.memberId))
    .innerJoin(products, eq(orders.productId, products.productId))
    .where(eq(orders.cycleId, cycleId))
    .orderBy(asc(products.sortOrder), asc(members.fullName));

  const productMap = new Map<string, CycleSummary["byProduct"][number]>();
  const memberMap = new Map<string, CycleSummary["byMember"][number]>();

  for (const row of rows) {
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
    productMap.get(row.productId)!.totalAmount += parseFloat(row.lineTotal);

    if (!memberMap.has(row.memberId)) {
      memberMap.set(row.memberId, { memberId: row.memberId, fullName: row.memberName, total: 0, lines: [] });
    }
    const m = memberMap.get(row.memberId)!;
    m.total += parseFloat(row.lineTotal);
    m.lines.push({ productName: row.productName, variant: row.variant, quantity: row.quantity, lineTotal: parseFloat(row.lineTotal) });
  }

  const byMember = Array.from(memberMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  return {
    byProduct: Array.from(productMap.values()),
    byMember,
    grandTotal: byMember.reduce((s, m) => s + m.total, 0),
    orderCount: byMember.length,
  };
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

export async function getAdminMemberLedger(memberId: string, limit = 100) {
  const db = getDb();
  const rows = await db
    .select({
      entryId: ledgerEntries.entryId,
      entryDate: ledgerEntries.entryDate,
      type: ledgerEntries.type,
      amount: ledgerEntries.amount,
      note: ledgerEntries.note,
      cycleTitle: orderCycles.title,
    })
    .from(ledgerEntries)
    .leftJoin(orderCycles, eq(ledgerEntries.cycleId, orderCycles.cycleId))
    .where(eq(ledgerEntries.memberId, memberId))
    .orderBy(desc(ledgerEntries.entryDate), desc(ledgerEntries.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    entryDate: r.entryDate?.toISOString() ?? null,
  }));
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

export type SupplierProductItem = {
  name: string;
  variant: string | null;
  format: string | null;
  unit: string | null;
  unitPrice: string;
  cycleTitle: string;
  pickupDate: string | null;
};

export async function getAllProductsWithSupplier(): Promise<Record<string, SupplierProductItem[]>> {
  const db = getDb();
  const rows = await db
    .select({
      supplierId: products.supplierId,
      name: products.name,
      variant: products.variant,
      format: products.format,
      unit: products.unit,
      unitPrice: products.unitPrice,
      cycleTitle: orderCycles.title,
      pickupDate: orderCycles.pickupDate,
    })
    .from(products)
    .innerJoin(orderCycles, eq(products.cycleId, orderCycles.cycleId))
    .where(isNotNull(products.supplierId))
    .orderBy(desc(orderCycles.createdAt), asc(products.sortOrder));

  const result: Record<string, SupplierProductItem[]> = {};
  for (const row of rows) {
    const sid = row.supplierId!;
    if (!result[sid]) result[sid] = [];
    result[sid].push({
      name: row.name,
      variant: row.variant,
      format: row.format,
      unit: row.unit,
      unitPrice: row.unitPrice,
      cycleTitle: row.cycleTitle,
      pickupDate: row.pickupDate?.toISOString() ?? null,
    });
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
    })
    .from(ledgerEntries)
    .leftJoin(orderCycles, eq(ledgerEntries.cycleId, orderCycles.cycleId))
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
    });
  }
  return result;
}
