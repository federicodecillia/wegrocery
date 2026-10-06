"use server";

import { eq, and, asc, isNull, sql } from "drizzle-orm";
import { liveLedger } from "@/lib/db/ledger-live";
import { requireAdmin } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { getDb } from "@/lib/db/client";
import {
  ledgerEntries,
  members,
  orders,
  products,
  suppliers,
} from "@/lib/db/schema";

export async function adminGetCycleOrderDetails(cycleId: string) {
  try {
    await requireAdmin();
    const db = getDb();

    const [rows, shippingRows, handlingRows] = await Promise.all([
      db
        .select({
          orderLineId: orders.orderLineId,
          memberId: members.memberId,
          memberName: members.fullName,
          productName: products.name,
          variant: products.variant,
          format: products.format,
          unit: products.unit,
          category: products.category,
          emoji: products.emoji,
          supplierName: suppliers.name,
          productSupplier: products.supplier,
          quantity: orders.quantity,
          unitPrice: orders.unitPriceSnapshot,
          pricePerKg: products.pricePerKg,
          lineTotal: orders.lineTotal,
          actualQuantity: orders.actualQuantity,
          actualLineTotal: orders.actualLineTotal,
        })
        .from(orders)
        .innerJoin(members, eq(orders.memberId, members.memberId))
        .innerJoin(products, eq(orders.productId, products.productId))
        .leftJoin(suppliers, eq(products.supplierId, suppliers.supplierId))
        .where(eq(orders.cycleId, cycleId))
        .orderBy(asc(members.fullName), asc(products.name)),
      db
        .select({
          memberId: ledgerEntries.memberId,
          memberName: members.fullName,
          amount: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')`,
        })
        .from(ledgerEntries)
        .innerJoin(members, eq(ledgerEntries.memberId, members.memberId))
        .where(
          and(
            eq(ledgerEntries.cycleId, cycleId),
            eq(ledgerEntries.type, "shipping_charge"),
            liveLedger,
          ),
        )
        .groupBy(ledgerEntries.memberId, members.fullName),
      db
        .select({
          memberId: ledgerEntries.memberId,
          memberName: members.fullName,
          amount: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')`,
        })
        .from(ledgerEntries)
        .innerJoin(members, eq(ledgerEntries.memberId, members.memberId))
        .where(
          and(
            eq(ledgerEntries.cycleId, cycleId),
            eq(ledgerEntries.type, "handling_charge"),
            liveLedger,
          ),
        )
        .groupBy(ledgerEntries.memberId, members.fullName),
    ]);

    // Shipping and the order preparation fee are stored as negative ledger
    // charges; report them as positive costs so the modal can add them to
    // the per-member subtotal.
    const toCost = (r: { memberId: string; memberName: string; amount: string }) => ({
      memberId: r.memberId,
      memberName: r.memberName,
      amount: Math.abs(parseFloat(r.amount)),
    });
    const shipping = shippingRows.map(toCost);
    const handling = handlingRows.map(toCost);

    return { success: true, orders: rows, shipping, handling };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}

// Returns everything the "Modifica ordine chiuso" editor needs in one call:
// the cycle's active product catalogue, the current order lines for the
// target member, and a flat list of active members so the admin can also
// add an order for someone who didn't originally order.
export type EditClosedOrderBootstrap = {
  products: Array<{
    productId: string;
    name: string;
    variant: string | null;
    format: string | null;
    unit: string | null;
    category: string | null;
    emoji: string | null;
    unitPrice: string;
    pricePerKg: string | null;
  }>;
  memberLines: Array<{
    productId: string;
    quantity: number;
    unitPriceSnapshot: string;
    lineTotal: string;
  }>;
  members: Array<{ memberId: string; fullName: string }>;
};

export async function adminGetEditClosedOrderBootstrap(
  cycleId: string,
  memberId: string | null,
): Promise<{ data?: EditClosedOrderBootstrap; error?: string }> {
  try {
    await requireAdmin();
    const db = getDb();

    const [productRows, lineRows, memberRows] = await Promise.all([
      db
        .select({
          productId: products.productId,
          name: products.name,
          variant: products.variant,
          format: products.format,
          unit: products.unit,
          category: products.category,
          emoji: products.emoji,
          unitPrice: products.unitPrice,
          pricePerKg: products.pricePerKg,
        })
        .from(products)
        .where(and(eq(products.cycleId, cycleId), eq(products.active, true)))
        .orderBy(asc(products.sortOrder), asc(products.name)),
      memberId
        ? db
            .select({
              productId: orders.productId,
              quantity: orders.quantity,
              unitPriceSnapshot: orders.unitPriceSnapshot,
              lineTotal: orders.lineTotal,
            })
            .from(orders)
            .where(and(eq(orders.cycleId, cycleId), eq(orders.memberId, memberId)))
        : Promise.resolve([] as Array<{
            productId: string;
            quantity: number;
            unitPriceSnapshot: string;
            lineTotal: string;
          }>),
      db
        .select({ memberId: members.memberId, fullName: members.fullName })
        .from(members)
        // A person in a family orders on the family's account.
        .where(and(eq(members.active, true), isNull(members.householdOf)))
        .orderBy(asc(members.fullName)),
    ]);

    return {
      data: {
        products: productRows,
        memberLines: lineRows,
        members: memberRows,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}
