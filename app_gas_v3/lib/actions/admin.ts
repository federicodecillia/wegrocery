"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
import { auditLog, ledgerEntries, members, orderCycles, orders, products } from "@/lib/db/schema";

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

// ── Ciclo ─────────────────────────────────────────────────────────────────────

export type CreateCycleInput = {
  title: string;
  pickupDate: string;
  orderCloseAt: string;
  supplierId: string;
  accessLevel: "attivi" | "all";
  notes: string;
};

export async function adminCreateCycle(data: CreateCycleInput) {
  const admin = await requireAdmin();
  if (!data.title?.trim()) throw new Error("Titolo obbligatorio");
  if (!data.orderCloseAt) throw new Error("Data chiusura ordine obbligatoria");

  const db = getDb();
  const [existing] = await db
    .select({ cycleId: orderCycles.cycleId })
    .from(orderCycles)
    .where(eq(orderCycles.status, "open"))
    .limit(1);
  if (existing) throw new Error("Esiste già un ciclo aperto. Chiudilo prima di crearne uno nuovo.");

  const cycleId = genId("cyc");
  const now = new Date();
  await db.insert(orderCycles).values({
    cycleId,
    title: data.title.trim(),
    pickupDate: data.pickupDate ? new Date(data.pickupDate) : null,
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
}

export async function adminCloseCycle(cycleId: string) {
  const admin = await requireAdmin();
  const db = getDb();

  const [cycle] = await db
    .select({ status: orderCycles.status })
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
      chargesGenerated = toInsert.length;
    }
  }

  await writeAudit(db, admin.email, "close_cycle", "cycle", cycleId, { chargesGenerated });
  revalidatePath("/admin");
  revalidatePath("/");
  return { chargesGenerated };
}

export async function adminUpdateCycle(
  cycleId: string,
  data: { title?: string; pickupDate?: string; orderCloseAt?: string; notes?: string },
) {
  const admin = await requireAdmin();
  const db = getDb();
  await db
    .update(orderCycles)
    .set({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.pickupDate !== undefined && {
        pickupDate: data.pickupDate ? new Date(data.pickupDate) : null,
      }),
      ...(data.orderCloseAt !== undefined && { orderCloseAt: new Date(data.orderCloseAt) }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    })
    .where(eq(orderCycles.cycleId, cycleId));
  await writeAudit(db, admin.email, "update_cycle", "cycle", cycleId, data);
  revalidatePath("/admin");
  revalidatePath("/");
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
      };
    });
}

export async function adminLoadProducts(cycleId: string, text: string) {
  const admin = await requireAdmin();
  const parsed = parseProductsText(text);
  if (parsed.length === 0) throw new Error("Nessun prodotto trovato nel testo");

  const db = getDb();
  await db.delete(products).where(eq(products.cycleId, cycleId));
  await db.insert(products).values(
    parsed.map((p, idx) => ({
      productId: genId("prd"),
      cycleId,
      name: p.name,
      variant: p.variant || null,
      format: p.format || null,
      unitPrice: p.unitPrice,
      supplier: p.supplier || null,
      notes: p.notes || null,
      sortOrder: idx + 1,
      active: true,
      category: p.category || null,
    })),
  );

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

  await db.delete(products).where(eq(products.cycleId, toCycleId));
  await db.insert(products).values(
    source.map((p, idx) => ({
      productId: genId("prd"),
      cycleId: toCycleId,
      name: p.name,
      variant: p.variant,
      format: p.format,
      unitPrice: p.unitPrice,
      supplier: p.supplier,
      notes: p.notes,
      sortOrder: idx + 1,
      active: true,
      category: p.category,
    })),
  );

  await writeAudit(db, admin.email, "duplicate_products", "cycle", toCycleId, {
    source: fromCycleId,
    count: source.length,
  });
  revalidatePath("/admin");
  revalidatePath("/ordine");
  return { count: source.length };
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

  await writeAudit(db, admin.email, "record_topup", "ledger", entryId, { memberId, amount });
  revalidatePath("/admin");
  revalidatePath("/");
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

export async function adminDeleteMember(memberId: string) {
  const admin = await requireAdmin();
  const db = getDb();

  const [orderCount] = await db
    .select({ n: sql<string>`count(*)` })
    .from(orders)
    .where(eq(orders.memberId, memberId));
  const [ledgerCount] = await db
    .select({ n: sql<string>`count(*)` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.memberId, memberId));

  if (parseInt(orderCount?.n ?? "0") > 0 || parseInt(ledgerCount?.n ?? "0") > 0) {
    throw new Error(
      "Non è possibile eliminare un socio con ordini o movimenti. Disattivalo invece.",
    );
  }

  await db.delete(members).where(eq(members.memberId, memberId));
  await writeAudit(db, admin.email, "delete_member", "member", memberId);
  revalidatePath("/admin");
}

// ── Soci ──────────────────────────────────────────────────────────────────────

export type UpsertMemberInput = {
  memberId?: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
};

export async function adminUpsertMember(data: UpsertMemberInput) {
  const admin = await requireAdmin();
  if (!data.fullName?.trim()) throw new Error("Nome obbligatorio");
  if (!data.email?.trim()) throw new Error("Email obbligatoria");

  const db = getDb();
  const now = new Date();

  if (data.memberId) {
    await db
      .update(members)
      .set({
        fullName: data.fullName.trim(),
        email: data.email.toLowerCase().trim(),
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
      role: data.role,
      active: data.active,
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(db, admin.email, "create_member", "member", memberId, data);
  }

  revalidatePath("/admin");
}
