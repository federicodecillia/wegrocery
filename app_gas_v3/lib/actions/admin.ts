"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql, or, isNull, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
import { auditLog, ledgerEntries, members, notifications, orderCycles, orders, products, suppliers, supplierProducts } from "@/lib/db/schema";

async function requireAdmin(): Promise<{ email: string }> {
  const session = await auth();
  const email = session?.user?.email;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!email || role !== "admin") throw new Error("Accesso non autorizzato");
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

export type CreateCycleInput = {
  title: string;
  pickupDate: string;
  pickupEndTime: string;
  orderCloseAt: string;
  supplierId?: string; // Principal supplier (optional)
  accessLevel: "admin" | "soci" | "utenti" | string;
  notes: string;
};

export async function adminCreateCycle(data: CreateCycleInput): Promise<{error?: string}> {
  try {
    const admin = await requireAdmin();
    if (!data.title?.trim()) return { error: "Titolo obbligatorio" };
    if (!data.orderCloseAt) return { error: "Data chiusura ordine obbligatoria" };

    const db = getDb();

    const cycleId = genId("cyc");
    const now = new Date();
    await db.insert(orderCycles).values({
      cycleId,
      title: data.title.trim(),
      pickupDate: data.pickupDate ? new Date(data.pickupDate) : null,
      pickupEndTime: data.pickupEndTime || null,
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
    return { error: e instanceof Error ? e.message : "Errore nella creazione del ciclo" };
  }
}

export async function adminCloseCycle(cycleId: string) {
  const admin = await requireAdmin();
  const db = getDb();

  const [cycle] = await db
    .select({ status: orderCycles.status, title: orderCycles.title })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!cycle) throw new Error("Ciclo non trovato");
  if (cycle.status !== "open") throw new Error("Il ciclo non è aperto");

  const now = new Date();
  await db
    .update(orderCycles)
    .set({ status: "closed", closedAt: now })
    .where(eq(orderCycles.cycleId, cycleId));

  const [existingCharge] = await db
    .select({ entryId: ledgerEntries.entryId })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.cycleId, cycleId), eq(ledgerEntries.type, "order_charge")))
    .limit(1);

  let chargesGenerated = 0;
  if (!existingCharge) {
    const memberTotals = await db
      .select({
        memberId: orders.memberId,
        total: sql<string>`sum(${orders.lineTotal})`,
      })
      .from(orders)
      .where(eq(orders.cycleId, cycleId))
      .groupBy(orders.memberId);

    const toInsert = memberTotals.filter((r) => parseFloat(r.total) > 0);
    if (toInsert.length > 0) {
      await db.insert(ledgerEntries).values(
        toInsert.map((r) => ({
          entryId: genId("led"),
          memberId: r.memberId,
          entryDate: now,
          type: "order_charge",
          amount: (-parseFloat(r.total)).toFixed(2),
          cycleId,
          note: "Addebito ordine",
          createdBy: admin.email,
          createdAt: now,
        })),
      );
      await db.insert(notifications).values(
        toInsert.map((r) => {
          const total = parseFloat(r.total);
          return {
            notificationId: genId("not"),
            memberId: r.memberId,
            role: null,
            type: "order_closed",
            title: "Ordine chiuso",
            body: `E' stato chiuso "${cycle.title}". Ti e' stato addebitato ${total.toFixed(2).replace(".", ",")} euro.`,
            href: "/storico",
            readAt: null,
            createdAt: now,
          };
        }),
      );
      chargesGenerated = toInsert.length;
    }
  }

  await writeAudit(db, admin.email, "close_cycle", "cycle", cycleId, { chargesGenerated });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/storico");
  return { chargesGenerated };
}

export async function adminUpdateCycle(
  cycleId: string,
  data: { title?: string; pickupDate?: string; pickupEndTime?: string; orderCloseAt?: string; notes?: string; supplierId?: string; accessLevel?: string },
): Promise<{error?: string}> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    await db
      .update(orderCycles)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.pickupDate !== undefined && {
          pickupDate: data.pickupDate ? new Date(data.pickupDate) : null,
        }),
        ...(data.pickupEndTime !== undefined && { pickupEndTime: data.pickupEndTime || null }),
        ...(data.orderCloseAt !== undefined && { orderCloseAt: new Date(data.orderCloseAt) }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId || null }),
        ...(data.accessLevel !== undefined && { accessLevel: data.accessLevel }),
      })
      .where(eq(orderCycles.cycleId, cycleId));
    await writeAudit(db, admin.email, "update_cycle", "cycle", cycleId, data);
    revalidatePath("/admin");
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore nell'aggiornamento del ciclo" };
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

async function upsertCycleProducts(
  db: ReturnType<typeof getDb>,
  cycleId: string,
  newProducts: Array<{
    name: string;
    variant: string | null;
    format: string | null;
    unitPrice: string | number;
    unit: string | null;
    supplier: string | null;
    notes: string | null;
    category: string | null;
    supplierId?: string | null;
    emoji?: string | null;
  }>
) {
  const existingProducts = await db
    .select()
    .from(products)
    .where(eq(products.cycleId, cycleId));

  const [maxSortRow] = await db
    .select({ max: sql<number>`max(${products.sortOrder})` })
    .from(products)
    .where(eq(products.cycleId, cycleId));
  let currentSort = maxSortRow?.max || 0;

  const existingMap = new Map();
  for (const p of existingProducts) {
    const key = `${p.name.toLowerCase().trim()}|${p.variant?.toLowerCase().trim() || ""}|${p.format?.toLowerCase().trim() || ""}|${p.unit?.toLowerCase().trim() || ""}`;
    existingMap.set(key, p);
  }

  const inserts = [];
  for (const np of newProducts) {
    const key = `${np.name.toLowerCase().trim()}|${np.variant?.toLowerCase().trim() || ""}|${np.format?.toLowerCase().trim() || ""}|${np.unit?.toLowerCase().trim() || ""}`;
    const existing = existingMap.get(key);
    const unitPriceStr = typeof np.unitPrice === "number" ? np.unitPrice.toFixed(2) : np.unitPrice;

    if (existing) {
      await db.update(products).set({
        unitPrice: unitPriceStr,
        notes: np.notes || existing.notes,
        category: np.category || existing.category,
        supplier: np.supplier || existing.supplier,
        supplierId: np.supplierId ?? existing.supplierId,
        emoji: np.emoji || existing.emoji,
        active: true,
      }).where(eq(products.productId, existing.productId));
    } else {
      currentSort++;
      inserts.push({
        productId: genId("prd"),
        cycleId,
        name: np.name.trim(),
        variant: np.variant?.trim() || null,
        format: np.format?.trim() || null,
        unit: np.unit?.trim() || null,
        unitPrice: unitPriceStr,
        supplier: np.supplier?.trim() || null,
        supplierId: np.supplierId?.trim() || null,
        notes: np.notes?.trim() || null,
        sortOrder: currentSort,
        active: true,
        category: np.category?.trim() || null,
        emoji: np.emoji?.trim() || null,
      });
      // also add to map to prevent duplicates within the same batch
      existingMap.set(key, true);
    }
  }

  if (inserts.length > 0) {
    await db.insert(products).values(inserts);
  }
}

export async function adminLoadProducts(cycleId: string, text: string) {
  const admin = await requireAdmin();
  const parsed = parseProductsText(text);
  if (parsed.length === 0) throw new Error("Nessun prodotto trovato nel testo");

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
  if (source.length === 0) throw new Error("Nessun prodotto nel ciclo sorgente");

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
    notes?: string;
  }
): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    await db
      .update(products)
      .set({
        name: data.name,
        variant: data.variant || null,
        format: data.format || null,
        unit: data.unit || null,
        category: data.category || null,
        unitPrice: data.unitPrice.toFixed(2),
        notes: data.notes || null,
      })
      .where(eq(products.productId, productId));
      
    await writeAudit(db, admin.email, "update_cycle_product", "product", productId, data);
    revalidatePath("/admin");
    revalidatePath("/ordine");
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Errore" };
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
  if (amount <= 0) throw new Error("L'importo deve essere positivo");

  const db = getDb();
  const [member] = await db
    .select({ memberId: members.memberId })
    .from(members)
    .where(eq(members.memberId, memberId))
    .limit(1);
  if (!member) throw new Error("Socio non trovato");

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
    title: "Bonifico ricevuto",
    body: `Il tuo bonifico di ${amount.toFixed(2).replace(".", ",")} euro e' stato ricevuto. Il tuo nuovo credito e' ${newBalance.toFixed(2).replace(".", ",")} euro.`,
    href: "/storico",
    createdAt: now,
  });

  await writeAudit(db, admin.email, "record_topup", "ledger", entryId, { memberId, amount });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/storico");
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
        error: "Non è possibile eliminare un socio con ordini o movimenti. Disattivalo invece.",
      };
    }

    await db.delete(members).where(eq(members.memberId, memberId));
    await writeAudit(db, admin.email, "delete_member", "member", memberId);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
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
  if (!data.fullName?.trim()) throw new Error("Nome obbligatorio");
  if (!data.email?.trim()) throw new Error("Email obbligatoria");

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
  if (!data.name?.trim()) throw new Error("Nome obbligatorio");

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
      return { error: "Non è possibile eliminare un fornitore con cicli associati. Archivialo invece." };
    }
    await db.delete(suppliers).where(eq(suppliers.supplierId, supplierId));
    await writeAudit(db, admin.email, "delete_supplier", "supplier", supplierId);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
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

      if (!existing) return { error: "Prodotto non trovato a catalogo" };

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
      const newId = genId("cp");
      await db.insert(supplierProducts).values({
        catalogProductId: newId,
        supplierId: data.supplierId,
        name: data.name,
        variant: data.variant || null,
        format: data.format || null,
        unit: data.unit || null,
        unitPrice: data.unitPrice.toString(),
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
    return { error: e instanceof Error ? e.message : "Errore" };
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
    return { error: e instanceof Error ? e.message : "Errore" };
  }
}

export async function adminLoadFromCatalog(cycleId: string, catalogProductIds: string[]): Promise<{error?: string; count?: number}> {
  try {
    if (!catalogProductIds.length) return { error: "Nessun prodotto selezionato" };
    const admin = await requireAdmin();
    const db = getDb();

    const selectedProducts = await db
      .select()
      .from(supplierProducts)
      .where(and(inArray(supplierProducts.catalogProductId, catalogProductIds), eq(supplierProducts.active, true)));

    if (!selectedProducts.length) return { error: "Prodotti non trovati o non attivi" };

    await upsertCycleProducts(db, cycleId, selectedProducts.map(p => ({
      name: p.name,
      variant: p.variant,
      format: p.format,
      unitPrice: p.unitPrice,
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
    return { error: e instanceof Error ? e.message : "Errore" };
  }
}

export async function adminCleanupIncompleteProducts(): Promise<{error?: string}> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    
    // Incomplete in catalog
    await db.delete(supplierProducts)
      .where(or(
        isNull(supplierProducts.unit),
        eq(supplierProducts.unit, ""),
        eq(supplierProducts.unitPrice, "0")
      ));
    
    // Incomplete in current cycles
    await db.delete(products)
      .where(or(
        isNull(products.unit),
        eq(products.unit, ""),
        eq(products.unitPrice, "0")
      ));
    
    await writeAudit(db, admin.email, "cleanup_incomplete_products", "catalog", "");
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
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
    return { error: e instanceof Error ? e.message : "Errore" };
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
