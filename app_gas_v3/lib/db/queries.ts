import { desc, eq, and, sql, asc } from "drizzle-orm";
import { getDb } from "./client";
import {
  ledgerEntries,
  members,
  orderCycles,
  orders,
  products,
  suppliers,
} from "./schema";

export async function getMemberByEmail(email: string) {
  const db = getDb();
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.email, email))
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

export async function getOpenCycle() {
  const db = getDb();
  const [cycle] = await db
    .select()
    .from(orderCycles)
    .where(eq(orderCycles.status, "open"))
    .limit(1);
  return cycle ?? null;
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
  lines: { productName: string; variant: string | null; quantity: number }[];
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
      productName: products.name,
      variant: products.variant,
      sortOrder: products.sortOrder,
    })
    .from(orders)
    .innerJoin(orderCycles, eq(orders.cycleId, orderCycles.cycleId))
    .innerJoin(products, eq(orders.productId, products.productId))
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
    });
  }
  return Array.from(cycleMap.values());
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
    .select()
    .from(products)
    .where(eq(products.cycleId, cycleId))
    .orderBy(asc(products.sortOrder), asc(products.name));
}

export async function getAdminMemberLedger(memberId: string, limit = 100) {
  const db = getDb();
  return db
    .select({
      entryId: ledgerEntries.entryId,
      memberId: ledgerEntries.memberId,
      entryDate: ledgerEntries.entryDate,
      type: ledgerEntries.type,
      amount: ledgerEntries.amount,
      cycleId: ledgerEntries.cycleId,
      note: ledgerEntries.note,
      createdBy: ledgerEntries.createdBy,
      createdAt: ledgerEntries.createdAt,
      updatedAt: ledgerEntries.updatedAt,
      updatedBy: ledgerEntries.updatedBy,
      cycleTitle: orderCycles.title,
    })
    .from(ledgerEntries)
    .leftJoin(orderCycles, eq(ledgerEntries.cycleId, orderCycles.cycleId))
    .where(eq(ledgerEntries.memberId, memberId))
    .orderBy(desc(ledgerEntries.entryDate), desc(ledgerEntries.createdAt))
    .limit(limit);
}
