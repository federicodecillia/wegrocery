"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { auditLog, ledgerEntries, members, notifications, orderCycles, orders, products, suppliers, supplierProducts } from "@/lib/db/schema";
import { upsertCycleProducts } from "@/lib/db/cycle-products";

async function requireAdmin(): Promise<{ email: string }> {
  const session = await auth();
  const email = session?.user?.email;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!email || role !== "admin") throw new Error(t.errors.unauthorized);
  return { email };
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

async function createNotification(
  db: ReturnType<typeof getDb>,
  data: {
    memberId?: string | null;
    role?: string | null;
    type: string;
    title: string;
    body: string;
    href?: string | null;
    createdAt?: Date;
  },
) {
  await db.insert(notifications).values({
    notificationId: genId("not"),
    memberId: data.memberId ?? null,
    role: data.role ?? null,
    type: data.type,
    title: data.title,
    body: data.body,
    href: data.href ?? null,
    readAt: null,
    createdAt: data.createdAt ?? new Date(),
  });
}

// ── Ciclo ─────────────────────────────────────────────────────────────────────

export type ShippingMode = "fixed_per_member" | "proportional";

export type CreateCycleInput = {
  title: string;
  pickupDate: string;
  pickupEndTime: string;
  pickup2Date: string;
  pickup2EndTime: string;
  orderCloseAt: string;
  supplierId?: string;
  accessLevel: "admin" | "soci" | "utenti" | string;
  notes: string;
  shippingMode: ShippingMode;
  shippingCostPerMember: string;
  shippingTotal: string;
};

function normalizeShippingMode(mode: string | undefined): ShippingMode {
  return mode === "proportional" ? "proportional" : "fixed_per_member";
}

// Returns each member's shipping share in euros, keyed by memberId.
// - fixed_per_member: every member pays shippingCostPerMember.
// - proportional: shippingTotal is split weighted by each member's order total,
//   each share rounded to 2 decimals. Any cent left over by the rounding (so
//   that sum-of-shares equals shippingTotal exactly) is added to the member
//   with the largest order — picking deterministically so reruns match.
function computeShippingShares(
  memberTotals: ReadonlyArray<{ memberId: string; total: string }>,
  cycle: {
    shippingMode: string;
    shippingCostPerMember: string | null;
    shippingTotal: string | null;
  },
): Map<string, number> {
  const shares = new Map<string, number>();
  if (memberTotals.length === 0) return shares;

  if (cycle.shippingMode === "proportional") {
    const shippingTotal = cycle.shippingTotal ? parseFloat(cycle.shippingTotal) : 0;
    if (shippingTotal <= 0) return shares;

    const grand = memberTotals.reduce((sum, r) => sum + parseFloat(r.total), 0);
    if (grand <= 0) return shares;

    let allocatedCents = 0;
    const targetCents = Math.round(shippingTotal * 100);

    for (const r of memberTotals) {
      const memberTotal = parseFloat(r.total);
      const cents = Math.round((memberTotal / grand) * targetCents);
      shares.set(r.memberId, cents / 100);
      allocatedCents += cents;
    }

    const drift = targetCents - allocatedCents;
    if (drift !== 0) {
      // Pick the member with the largest order; ties broken by memberId for
      // determinism so two reruns produce the same allocation.
      const heaviest = [...memberTotals].sort((a, b) => {
        const diff = parseFloat(b.total) - parseFloat(a.total);
        return diff !== 0 ? diff : a.memberId.localeCompare(b.memberId);
      })[0];
      const current = shares.get(heaviest.memberId) ?? 0;
      shares.set(heaviest.memberId, current + drift / 100);
    }
    return shares;
  }

  const flat = cycle.shippingCostPerMember ? parseFloat(cycle.shippingCostPerMember) : 0;
  if (flat <= 0) return shares;
  for (const r of memberTotals) shares.set(r.memberId, flat);
  return shares;
}

export async function adminCreateCycle(data: CreateCycleInput): Promise<{error?: string}> {
  try {
    const admin = await requireAdmin();
    if (!data.title?.trim()) return { error: t.errors.fieldRequired(t.fields.title) };
    if (!data.orderCloseAt) return { error: t.errors.fieldRequired(t.fields.orderCloseDate) };

    const db = getDb();

    const cycleId = genId("cyc");
    const now = new Date();
    const shippingMode = normalizeShippingMode(data.shippingMode);
    await db.insert(orderCycles).values({
      cycleId,
      title: data.title.trim(),
      pickupDate: data.pickupDate ? new Date(data.pickupDate) : null,
      pickupEndTime: data.pickupEndTime || null,
      pickup2Date: data.pickup2Date ? new Date(data.pickup2Date) : null,
      pickup2EndTime: data.pickup2EndTime || null,
      shippingMode,
      shippingCostPerMember:
        shippingMode === "fixed_per_member" && data.shippingCostPerMember
          ? data.shippingCostPerMember
          : null,
      shippingTotal:
        shippingMode === "proportional" && data.shippingTotal ? data.shippingTotal : null,
      orderOpenAt: now,
      orderCloseAt: new Date(data.orderCloseAt),
      status: "open",
      accessLevel: data.accessLevel || "attivi",
      notes: data.notes?.trim() || null,
      createdBy: admin.email,
      createdAt: now,
      supplierId: data.supplierId || null,
    });

    await writeAudit(db, admin.email, "create_cycle", "cycle", cycleId, data);
    revalidatePath("/admin");
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.cycleCreationError };
  }
}

// Internal: performs the actual close-cycle work — CAS, ledger inserts,
// notifications, and rollback on failure. Returns chargesGenerated.
// Callers are responsible for requireAdmin(), audit log, and revalidation.
async function performCycleClose(
  db: ReturnType<typeof getDb>,
  cycleId: string,
  adminEmail: string,
): Promise<{ chargesGenerated: number }> {
  const now = new Date();

  // Atomic compare-and-swap: only the caller that flips status open→closed
  // proceeds. A second concurrent call gets 0 rows back and exits cleanly.
  const closed = await db
    .update(orderCycles)
    .set({ status: "closed", closedAt: now })
    .where(and(eq(orderCycles.cycleId, cycleId), eq(orderCycles.status, "open")))
    .returning({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      shippingMode: orderCycles.shippingMode,
      shippingCostPerMember: orderCycles.shippingCostPerMember,
      shippingTotal: orderCycles.shippingTotal,
    });

  if (closed.length === 0) {
    const [existing] = await db
      .select({ status: orderCycles.status })
      .from(orderCycles)
      .where(eq(orderCycles.cycleId, cycleId))
      .limit(1);
    if (!existing) throw new Error(t.errors.cycleNotFound);
    throw new Error(t.errors.cycleNotFoundOrAlreadyClosed);
  }

  const cycle = closed[0];

  // The CAS guarantees only one caller reaches this branch, so duplicate
  // ledger entries can only happen if the previous attempt failed mid-way and
  // left the cycle closed. Belt-and-suspenders: still check.
  const [existingCharge] = await db
    .select({ entryId: ledgerEntries.entryId })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.cycleId, cycleId), eq(ledgerEntries.type, "order_charge")))
    .limit(1);

  let chargesGenerated = 0;

  if (!existingCharge) {
    try {
      const memberTotals = await db
        .select({
          memberId: orders.memberId,
          total: sql<string>`sum(${orders.lineTotal})`,
        })
        .from(orders)
        .where(eq(orders.cycleId, cycleId))
        .groupBy(orders.memberId);

      const toInsert = memberTotals.filter((r) => parseFloat(r.total) > 0);

      // Pre-compute each member's shipping share. For "proportional" mode the
      // shares sum to shippingTotal; rounding leftovers (sum-of-cents drift)
      // are absorbed by the largest order so the total stays exact.
      const shippingShares = computeShippingShares(toInsert, cycle);

      if (toInsert.length > 0) {
        await db.insert(ledgerEntries).values(
          toInsert.map((r) => ({
            entryId: genId("led"),
            memberId: r.memberId,
            entryDate: now,
            type: "order_charge",
            amount: (-parseFloat(r.total)).toFixed(2),
            cycleId,
            note: t.ledger.orderCharge,
            createdBy: adminEmail,
            createdAt: now,
          })),
        );

        const shippingEntries = toInsert
          .map((r) => ({ memberId: r.memberId, share: shippingShares.get(r.memberId) ?? 0 }))
          .filter((s) => s.share > 0);
        if (shippingEntries.length > 0) {
          await db.insert(ledgerEntries).values(
            shippingEntries.map((s) => ({
              entryId: genId("led"),
              memberId: s.memberId,
              entryDate: now,
              type: "shipping_charge",
              amount: (-s.share).toFixed(2),
              cycleId,
              note:
                cycle.shippingMode === "proportional"
                  ? "Spedizione (quota proporzionale)"
                  : "Spedizione",
              createdBy: adminEmail,
              createdAt: now,
            })),
          );
        }

        await db.insert(notifications).values(
          toInsert.map((r) => {
            const orderTotal = parseFloat(r.total);
            const shippingShare = shippingShares.get(r.memberId) ?? 0;
            const totalCharged = orderTotal + shippingShare;
            const body =
              shippingShare > 0
                ? t.notificationsServer.orderClosedBodyWithShipping(
                    cycle.title,
                    formatMoney(totalCharged),
                    formatMoney(orderTotal),
                    formatMoney(shippingShare),
                  )
                : t.notificationsServer.orderClosedBody(cycle.title, formatMoney(orderTotal));
            return {
              notificationId: genId("not"),
              memberId: r.memberId,
              role: null,
              type: "order_closed",
              title: t.notificationsServer.orderClosedTitle,
              body,
              href: `/storico?cycleId=${cycleId}`,
              readAt: null,
              createdAt: now,
            };
          }),
        );
        chargesGenerated = toInsert.length;
      }
    } catch (e) {
      // Rollback the status flip so the admin can retry instead of leaving
      // the cycle in a half-closed state with no charges.
      await db
        .update(orderCycles)
        .set({ status: "open", closedAt: null })
        .where(eq(orderCycles.cycleId, cycleId));
      throw e;
    }
  }

  return { chargesGenerated };
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

  // Apply the price adjustments before flipping status. We do not use a
  // transaction (neon-http does not support interactive ones), but the
  // CAS inside performCycleClose still guarantees that only one caller
  // proceeds to generate charges.
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

// Recomputes shipping_charge ledger entries for a closed cycle after its
// shipping configuration changed. Updates existing entries in place (we never
// delete to keep the audit trail), inserts new entries for members who had
// no previous share, and emits an `order_adjusted` notification per affected
// member. Returns the list of memberIds whose shipping share actually moved.
async function recomputeShippingForClosedCycle(
  db: ReturnType<typeof getDb>,
  cycleId: string,
  adminEmail: string,
): Promise<{ adjustedMembers: string[] }> {
  const [cycle] = await db
    .select({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      shippingMode: orderCycles.shippingMode,
      shippingCostPerMember: orderCycles.shippingCostPerMember,
      shippingTotal: orderCycles.shippingTotal,
    })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!cycle) return { adjustedMembers: [] };
  // Manual mode: per-member shipping was set by a supplier-distinta import.
  // Skip recompute so an unrelated cycle edit doesn't blow away the
  // per-member values.
  if (cycle.shippingMode === "manual") return { adjustedMembers: [] };

  const memberTotals = await db
    .select({
      memberId: orders.memberId,
      total: sql<string>`sum(${orders.lineTotal})`,
    })
    .from(orders)
    .where(eq(orders.cycleId, cycleId))
    .groupBy(orders.memberId);
  const eligible = memberTotals.filter((r) => parseFloat(r.total) > 0);

  const newShares = computeShippingShares(eligible, cycle);

  const existing = await db
    .select({
      entryId: ledgerEntries.entryId,
      memberId: ledgerEntries.memberId,
      amount: ledgerEntries.amount,
    })
    .from(ledgerEntries)
    .where(
      and(eq(ledgerEntries.cycleId, cycleId), eq(ledgerEntries.type, "shipping_charge")),
    );
  const existingByMember = new Map(existing.map((e) => [e.memberId, e]));

  const now = new Date();
  const adjusted: string[] = [];

  for (const r of eligible) {
    const newShare = newShares.get(r.memberId) ?? 0;
    const prev = existingByMember.get(r.memberId);
    const oldShare = prev ? -parseFloat(prev.amount) : 0;
    if (Math.abs(newShare - oldShare) < 0.005) continue;

    if (prev) {
      await db
        .update(ledgerEntries)
        .set({
          amount: (-newShare).toFixed(2),
          note: t.ledger.shippingAdjusted,
          updatedAt: now,
          updatedBy: adminEmail,
        })
        .where(eq(ledgerEntries.entryId, prev.entryId));
    } else if (newShare > 0) {
      await db.insert(ledgerEntries).values({
        entryId: genId("led"),
        memberId: r.memberId,
        entryDate: now,
        type: "shipping_charge",
        amount: (-newShare).toFixed(2),
        cycleId,
        note: t.ledger.shippingAdjusted,
        createdBy: adminEmail,
        createdAt: now,
      });
    }

    await createNotification(db, {
      memberId: r.memberId,
      type: "order_adjusted",
      title: `Spedizione "${cycle.title}" aggiornata`,
      body: `Le spese di spedizione del ciclo "${cycle.title}" sono state aggiornate: la tua quota e' passata da ${formatMoney(oldShare)} a ${formatMoney(newShare)}.`,
      href: "/storico",
    });

    adjusted.push(r.memberId);
  }

  return { adjustedMembers: adjusted };
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
        shippingMode: orderCycles.shippingMode,
        shippingCostPerMember: orderCycles.shippingCostPerMember,
        shippingTotal: orderCycles.shippingTotal,
      })
      .from(orderCycles)
      .where(eq(orderCycles.cycleId, cycleId))
      .limit(1);
    if (!before) return { error: t.errors.cycleNotFound };

    const isClosed = before.status === "closed";
    const shippingTouched =
      data.shippingMode !== undefined ||
      data.shippingCostPerMember !== undefined ||
      data.shippingTotal !== undefined;

    // When shippingMode is provided we treat it as authoritative: also clear
    // the field belonging to the other mode so we never end up with stale
    // values being read at close time.
    const shippingPatch =
      data.shippingMode !== undefined
        ? (() => {
            const mode = normalizeShippingMode(data.shippingMode);
            return {
              shippingMode: mode,
              shippingCostPerMember:
                mode === "fixed_per_member" ? data.shippingCostPerMember || null : null,
              shippingTotal: mode === "proportional" ? data.shippingTotal || null : null,
            };
          })()
        : {
            ...(data.shippingCostPerMember !== undefined && {
              shippingCostPerMember: data.shippingCostPerMember || null,
            }),
            ...(data.shippingTotal !== undefined && {
              shippingTotal: data.shippingTotal || null,
            }),
          };

    await db
      .update(orderCycles)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.pickupDate !== undefined && {
          pickupDate: data.pickupDate ? new Date(data.pickupDate) : null,
        }),
        ...(data.pickupEndTime !== undefined && { pickupEndTime: data.pickupEndTime || null }),
        ...(data.pickup2Date !== undefined && {
          pickup2Date: data.pickup2Date ? new Date(data.pickup2Date) : null,
        }),
        ...(data.pickup2EndTime !== undefined && { pickup2EndTime: data.pickup2EndTime || null }),
        ...(data.orderCloseAt !== undefined && { orderCloseAt: new Date(data.orderCloseAt) }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId || null }),
        ...(data.accessLevel !== undefined && { accessLevel: data.accessLevel }),
        ...shippingPatch,
      })
      .where(eq(orderCycles.cycleId, cycleId));

    let adjustedMembers = 0;
    if (isClosed && shippingTouched) {
      const { adjustedMembers: m } = await recomputeShippingForClosedCycle(
        db,
        cycleId,
        admin.email,
      );
      adjustedMembers = m.length;
      await writeAudit(db, admin.email, "cycle_shipping_recomputed", "cycle", cycleId, {
        before: {
          shippingMode: before.shippingMode,
          shippingCostPerMember: before.shippingCostPerMember,
          shippingTotal: before.shippingTotal,
        },
        after: {
          shippingMode: data.shippingMode,
          shippingCostPerMember: data.shippingCostPerMember,
          shippingTotal: data.shippingTotal,
        },
        affectedMembers: m,
      });
      revalidatePath("/storico");
      revalidatePath("/notifiche");
    }

    await writeAudit(db, admin.email, "update_cycle", "cycle", cycleId, data);
    revalidatePath("/admin");
    revalidatePath("/");
    return { adjustedMembers };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.cycleUpdateError };
  }
}

// ── Prodotti ──────────────────────────────────────────────────────────────────

function parseProductsText(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((line, idx) => {
      const parts = line.split(";").map((p) => p.trim());
      const name = parts[0] ?? "";
      const rawPrice = (parts[3] ?? "0").replace(",", ".");
      const unitPrice = parseFloat(rawPrice);
      if (!name) throw new Error(`Riga ${idx + 1}: nome mancante`);
      if (isNaN(unitPrice) || unitPrice < 0) throw new Error(`Riga ${idx + 1}: prezzo non valido`);
      return {
        name,
        variant: parts[1] ?? "",
        format: parts[2] ?? "",
        unitPrice: unitPrice.toFixed(2),
        supplier: parts[4] ?? "",
        notes: parts[5] ?? "",
        category: parts[6] ?? "",
        unit: parts[7] ?? "",
      };
    });
}

export async function adminLoadProducts(cycleId: string, text: string) {
  const admin = await requireAdmin();
  const parsed = parseProductsText(text);
  if (parsed.length === 0) throw new Error(t.errors.noProductsInText);

  const db = getDb();
  await upsertCycleProducts(db, cycleId, parsed);

  await writeAudit(db, admin.email, "load_products", "cycle", cycleId, { count: parsed.length });
  revalidatePath("/admin");
  revalidatePath("/ordine");
  return { count: parsed.length };
}

export async function adminDuplicateProducts(fromCycleId: string, toCycleId: string) {
  const admin = await requireAdmin();
  const db = getDb();

  const source = await db
    .select()
    .from(products)
    .where(eq(products.cycleId, fromCycleId))
    .orderBy(products.sortOrder);
  if (source.length === 0) throw new Error(t.errors.noProductsInSourceCycle);

  await upsertCycleProducts(db, toCycleId, source);

  await writeAudit(db, admin.email, "duplicate_products", "cycle", toCycleId, {
    source: fromCycleId,
    count: source.length,
  });
  revalidatePath("/admin");
  revalidatePath("/ordine");
  return { count: source.length };
}

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

export async function adminRecordTopup(
  memberId: string,
  amount: number,
  note: string,
  entryDate: string,
) {
  const admin = await requireAdmin();
  if (amount <= 0) throw new Error(t.errors.amountMustBePositive);

  const db = getDb();
  const [member] = await db
    .select({ memberId: members.memberId })
    .from(members)
    .where(eq(members.memberId, memberId))
    .limit(1);
  if (!member) throw new Error(t.errors.memberNotFound);

  const now = new Date();
  const entryId = genId("led");
  await db.insert(ledgerEntries).values({
    entryId,
    memberId,
    entryDate: entryDate ? new Date(entryDate) : now,
    type: "topup",
    amount: amount.toFixed(2),
    cycleId: null,
    note: note?.trim() || "Ricarica",
    createdBy: admin.email,
    createdAt: now,
  });

  const [balanceRow] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.memberId, memberId));
  const newBalance = parseFloat(balanceRow?.total ?? "0");

  await createNotification(db, {
    memberId,
    type: "topup_received",
    title: t.notificationsServer.topupReceivedTitle,
    body: t.notificationsServer.topupReceivedBody(formatMoney(amount), formatMoney(newBalance)),
    href: "/storico",
    createdAt: now,
  });

  await writeAudit(db, admin.email, "record_topup", "ledger", entryId, { memberId, amount });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/storico");
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
      subject: `${brand.appName} — ${cycle.title}`,
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
      subject,
      text: defaults.text,
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
          `${line.productName}: ${line.quantity}${unit ? ` ${unit}` : ""} ordinati, ${qtyText}${unit ? ` ${unit}` : ""} ricevuti`,
        );
      } else if (newActualTotal !== null) {
        noteParts.push(`${line.productName}: costo aggiornato a ${formatMoney(newEffective)} EUR`);
      } else {
        noteParts.push(`${line.productName}: rettifica annullata`);
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

      const direction = delta > 0 ? "rimborso" : "addebito aggiuntivo";
      await createNotification(db, {
        memberId: line.memberId,
        type: "order_adjusted",
        title: `Ordine "${line.cycleTitle}" rettificato`,
        body: `${noteParts.join(" · ")} · ${direction} di ${formatMoney(Math.abs(delta))} EUR sul tuo saldo.`,
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
// posting an inverse correction.
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
    .select({ status: orderCycles.status, title: orderCycles.title })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, input.cycleId))
    .limit(1);
  if (!cycle) throw new Error(t.errors.cycleNotFound);
  if (cycle.status !== "closed") {
    throw new Error(t.errors.orderEditOnlyAfterClose);
  }

  const [member] = await db
    .select({ memberId: members.memberId, fullName: members.fullName })
    .from(members)
    .where(eq(members.memberId, input.memberId))
    .limit(1);
  if (!member) throw new Error(t.errors.memberNotFound);

  // Pull the current order rows so we can compute the delta.
  const previousLines = await db
    .select({
      orderLineId: orders.orderLineId,
      productId: orders.productId,
      quantity: orders.quantity,
      lineTotal: orders.lineTotal,
    })
    .from(orders)
    .where(and(eq(orders.cycleId, input.cycleId), eq(orders.memberId, input.memberId)));

  const oldTotal = previousLines.reduce((sum, l) => sum + parseFloat(l.lineTotal), 0);

  // Resolve the new lines against the cycle's active products. We use the
  // current `products.unitPrice` (which already reflects any close-time
  // adjustments) as the snapshot.
  const cleanLines = input.lines
    .map((l) => ({ productId: l.productId, quantity: Math.floor(l.quantity) }))
    .filter((l) => l.productId && l.quantity > 0);

  const productIds = Array.from(new Set(cleanLines.map((l) => l.productId)));
  const cycleProducts = productIds.length
    ? await db
        .select({
          productId: products.productId,
          unitPrice: products.unitPrice,
          name: products.name,
        })
        .from(products)
        .where(and(eq(products.cycleId, input.cycleId), inArray(products.productId, productIds)))
    : [];
  const productMap = new Map(cycleProducts.map((p) => [p.productId, p]));

  // Reject any line that points at a product not in this cycle — guards
  // against client-side tampering and stale UI state.
  for (const line of cleanLines) {
    if (!productMap.has(line.productId)) {
      throw new Error(t.errors.productNotValidForCycle);
    }
  }

  const newTotal = cleanLines.reduce((sum, l) => {
    const unitPrice = parseFloat(productMap.get(l.productId)!.unitPrice);
    return sum + unitPrice * l.quantity;
  }, 0);

  const delta = newTotal - oldTotal;
  const epsilon = 0.005;

  // Replace the order rows: simplest correct semantics for "final desired
  // state". neon-http has no transactions, so we delete then bulk-insert in
  // sequence — a partial failure would leave us with an empty/partial order
  // (visible to the member as "0 prodotti"), recoverable by re-running the
  // edit, never producing duplicate or orphan ledger entries.
  await db
    .delete(orders)
    .where(and(eq(orders.cycleId, input.cycleId), eq(orders.memberId, input.memberId)));

  if (cleanLines.length > 0) {
    await db.insert(orders).values(
      cleanLines.map((l) => {
        const p = productMap.get(l.productId)!;
        const lineTotal = (parseFloat(p.unitPrice) * l.quantity).toFixed(2);
        return {
          orderLineId: genId("ord"),
          cycleId: input.cycleId,
          memberId: input.memberId,
          productId: l.productId,
          quantity: l.quantity,
          unitPriceSnapshot: p.unitPrice,
          lineTotal,
          updatedAt: now,
        };
      }),
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
    await db.insert(ledgerEntries).values({
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
    });
  }

  // Member-facing notification with the human-readable diff.
  const [balanceRow] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.memberId, input.memberId));
  const newBalance = parseFloat(balanceRow?.total ?? "0");

  const dirSentence =
    Math.abs(delta) <= epsilon
      ? t.notificationsServer.orderModifiedBodyNoChange(cycle.title)
      : delta > 0
        ? t.notificationsServer.orderModifiedBodyCharge(cycle.title, formatMoney(delta))
        : t.notificationsServer.orderModifiedBodyRefund(cycle.title, formatMoney(-delta));

  await createNotification(db, {
    memberId: input.memberId,
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
    lineCount: cleanLines.length,
    note: input.note ?? null,
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

export async function adminUpdateLedgerEntry(
  entryId: string,
  data: { amount: number; note: string },
) {
  const admin = await requireAdmin();
  const db = getDb();
  await db
    .update(ledgerEntries)
    .set({ amount: data.amount.toFixed(2), note: data.note, updatedBy: admin.email, updatedAt: new Date() })
    .where(eq(ledgerEntries.entryId, entryId));
  await writeAudit(db, admin.email, "update_ledger", "ledger", entryId, data);
  revalidatePath("/admin");
}

export async function adminDeleteLedgerEntry(entryId: string) {
  const admin = await requireAdmin();
  const db = getDb();
  await db.delete(ledgerEntries).where(eq(ledgerEntries.entryId, entryId));
  await writeAudit(db, admin.email, "delete_ledger", "ledger", entryId);
  revalidatePath("/admin");
}

export async function adminDeleteMember(memberId: string): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();

    const [[orderCount], [ledgerCount]] = await Promise.all([
      db.select({ n: sql<string>`count(*)` }).from(orders).where(eq(orders.memberId, memberId)),
      db
        .select({ n: sql<string>`count(*)` })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.memberId, memberId)),
    ]);

    if (parseInt(orderCount?.n ?? "0") > 0 || parseInt(ledgerCount?.n ?? "0") > 0) {
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

export async function adminUpsertMember(data: UpsertMemberInput) {
  const admin = await requireAdmin();
  if (!data.fullName?.trim()) throw new Error(t.errors.fieldRequired(t.fields.name));
  if (!data.email?.trim()) throw new Error(t.errors.fieldRequired(t.fields.email));

  const aliasEmail = data.aliasEmail?.toLowerCase().trim() || null;
  const db = getDb();
  const now = new Date();

  if (data.memberId) {
    await db
      .update(members)
      .set({
        fullName: data.fullName.trim(),
        email: data.email.toLowerCase().trim(),
        aliasEmail,
        role: data.role,
        active: data.active,
        updatedAt: now,
      })
      .where(eq(members.memberId, data.memberId));
    await writeAudit(db, admin.email, "update_member", "member", data.memberId, data);
  } else {
    const memberId = genId("mem");
    await db.insert(members).values({
      memberId,
      fullName: data.fullName.trim(),
      email: data.email.toLowerCase().trim(),
      aliasEmail,
      role: data.role,
      active: data.active,
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(db, admin.email, "create_member", "member", memberId, data);
  }

  revalidatePath("/admin");
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

export async function adminCleanupIncompleteProducts(): Promise<{error?: string}> {
  try {
    const admin = await requireAdmin();
    const db = getDb();

    // A product is "incomplete" if its unit price is zero. We no longer
    // treat a missing `unit` as incomplete: starting from v1.4.3 the admin
    // form does not expose a Unità field anymore — the format string is
    // the source of truth (e.g. "Sacco 2kg") and `price_per_kg` provides
    // the optional reference price for weight-based items.

    await db.delete(supplierProducts)
      .where(eq(supplierProducts.unitPrice, "0"));

    await db.delete(products)
      .where(eq(products.unitPrice, "0"));
    
    await writeAudit(db, admin.email, "cleanup_incomplete_products", "catalog", "");
    revalidatePath("/admin");
    return {};
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
      await createNotification(db, {
        memberId,
        type: "order_adjusted",
        title: t.notificationsServer.pesataRegistrataTitle,
        body: bits.join(" "),
        href: "/storico",
      });
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
