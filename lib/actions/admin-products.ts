"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { t } from "@/lib/i18n";
import { getDb } from "@/lib/db/client";
import { supplierProducts, auditLog, suppliers } from "@/lib/db/schema";
import { getProductEmoji, getProductEmojiOrNull, guessProductCategory } from "@/lib/utils";
import { buildProductTemplate, parseProductTemplate } from "@/lib/csv/product-template";
import { inspectListing, pickSupplierMatch, type ListingInspection } from "@/lib/csv/supplier-listing-parser";
import { suggestMapping, TARGET_FIELDS, type TargetField } from "@/lib/csv/header-heuristics";
import { upsertCycleProducts } from "@/lib/db/cycle-products";

async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!email || role !== "admin") throw new Error(t.errors.unauthorized);
  return { email };
}

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export async function adminImportProductsCsv(supplierId: string, csvText: string) {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const now = new Date();

    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length <= 1) return { error: t.errors.csvEmpty };

    // Skip header
    const rows = lines.slice(1);
    const results = [];

    // New column layout (v1.4.3+):
    //   Nome; Varietà; Formato; Prezzo; Prezzo/kg; Categoria; Icona; Note
    //
    // The "Unità" column was removed because it duplicated the format string
    // and confused admins. Old templates that still include "Unità" are
    // handled below by sniffing the header row.

    const header = lines[0].toLowerCase();
    const usesLegacyLayout = header.includes("unità") || header.includes("unita");

    for (const row of rows) {
      // Robust parsing: try semicolon first (common in Italian Excel), then comma
      let columns = row.split(";").map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      if (columns.length < 4) {
        columns = row.split(",").map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      }

      if (columns.length < 4) continue; // need at least Nome, Varietà, Formato, Prezzo

      const name = columns[0];
      const variant = columns[1] || null;
      const format = columns[2] || null;

      let unit: string | null = null;
      let unitPriceStr: string;
      let pricePerKgStr: string | null = null;
      let category: string | null = null;
      let emoji: string;
      let notes: string | null = null;

      if (usesLegacyLayout) {
        // Legacy: Nome; Varietà; Formato; Unità; Prezzo; Categoria; Icona; Note
        unit = columns[3] || null;
        unitPriceStr = (columns[4] || "").replace(",", ".");
        category = columns[5] || null;
        emoji = columns[6] || getProductEmoji(name);
        notes = columns[7] || null;
      } else {
        // New: Nome; Varietà; Formato; Prezzo; Prezzo/kg; Categoria; Icona; Note
        unitPriceStr = (columns[3] || "").replace(",", ".");
        const ppk = (columns[4] || "").replace(",", ".");
        pricePerKgStr = ppk && !isNaN(parseFloat(ppk)) ? parseFloat(ppk).toFixed(2) : null;
        category = columns[5] || null;
        emoji = columns[6] || getProductEmoji(name);
        notes = columns[7] || null;
      }

      const unitPrice = parseFloat(unitPriceStr);
      if (isNaN(unitPrice)) continue;

      results.push({
        catalogProductId: genId("cp"),
        supplierId,
        name,
        variant,
        format,
        unit,
        unitPrice: unitPrice.toString(),
        pricePerKg: pricePerKgStr,
        category,
        emoji,
        notes,
        active: true,
        createdAt: now,
      });
    }

    if (results.length > 0) {
      await db.insert(supplierProducts).values(results);
      
      await db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "import_products_csv",
        entityType: "supplier",
        entityId: supplierId,
        payloadJson: JSON.stringify({ count: results.length }),
        createdAt: now,
      });

      revalidatePath("/admin");
      return { success: true, count: results.length };
    }

    return { error: t.errors.csvInvalid };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.importError };
  }
}

export async function adminBuildProductTemplate(): Promise<
  | { base64: string; filename: string }
  | { error: string }
> {
  try {
    await requireAdmin();
    const buf = await buildProductTemplate();
    return { base64: buf.toString("base64"), filename: "template_prodotti.xlsx" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.generationError };
  }
}

export async function adminImportProductsXlsx(supplierId: string, base64: string) {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const now = new Date();

    if (!supplierId) return { error: t.errors.fieldRequired(t.fields.supplier) };
    const buf = Buffer.from(base64, "base64");
    const rows = await parseProductTemplate(buf);
    if (rows.length === 0) return { error: t.errors.csvInvalid };

    const values = rows.map((r) => ({
      catalogProductId: genId("cp"),
      supplierId,
      name: r.name,
      variant: r.variant,
      format: r.format,
      unit: null as string | null,
      unitPrice: r.unitPrice,
      pricePerKg: r.pricePerKg,
      category: r.category,
      emoji: r.emoji ?? getProductEmoji(r.name),
      notes: r.notes,
      active: true,
      createdAt: now,
    }));

    await db.insert(supplierProducts).values(values);
    await db.insert(auditLog).values({
      auditId: crypto.randomUUID(),
      userEmail: admin.email,
      action: "import_products_xlsx",
      entityType: "supplier",
      entityId: supplierId,
      payloadJson: JSON.stringify({ count: values.length }),
      createdAt: now,
    });

    revalidatePath("/admin");
    return { success: true, count: values.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.importError };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Supplier listing wizard (free-form .xlsx / .csv → catalogue + optional cycle)
//
// Three actions: inspect (step 1), preview-diff (step 3 preview), apply (commit).
// The wizard component owns the UI state across the three steps; the server is
// stateless and the client passes back whatever it needs (selected sheet,
// mapping, supplier, emoji overrides).
// ────────────────────────────────────────────────────────────────────────────

export type WizardInspectionResult = {
  inspection: ListingInspection;
  suppliers: Array<{ supplierId: string; name: string }>;
  suggestedSupplierId: string | null;
  suggestedMappings: Array<Partial<Record<TargetField, number>>>;
};

export async function adminInspectSupplierListing(
  filename: string,
  base64: string,
): Promise<{ data?: WizardInspectionResult; error?: string }> {
  try {
    await requireAdmin();
    if (!filename || !base64) return { error: t.errors.fileMissing };

    const buf = Buffer.from(base64, "base64");
    const inspection = await inspectListing(buf, filename);
    if (!inspection.sheets.length) return { error: t.errors.fileEmptyOrUnreadable };

    const db = getDb();
    const sups = await db
      .select({ supplierId: suppliers.supplierId, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.active, true))
      .orderBy(suppliers.name);

    const match = pickSupplierMatch(inspection.supplierHints, sups);
    const suggestedMappings = inspection.sheets.map((s) => suggestMapping(s.columns));

    return {
      data: {
        inspection,
        suppliers: sups,
        suggestedSupplierId: match?.supplierId ?? null,
        suggestedMappings,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.xlsxReadError };
  }
}

export type WizardRow = {
  index: number;
  name: string;
  variant: string | null;
  format: string | null;
  unitPrice: string;
  pricePerKg: string | null;
  category: string | null;
  categoryGuessed: boolean;
  emoji: string;
  emojiAutoMatched: boolean;
  notes: string | null;
};

export type WizardDiffRow =
  | { kind: "new"; row: WizardRow }
  | { kind: "update_price"; row: WizardRow; oldPrice: string; catalogProductId: string }
  | { kind: "skip_unchanged"; row: WizardRow; catalogProductId: string }
  | { kind: "invalid"; index: number; raw: string[]; reason: string };

export type WizardApplyInput = {
  supplier: { existingId?: string; newName?: string };
  columns: string[];
  rows: string[][];
  mapping: Partial<Record<TargetField, number>>;
  emojiOverrides: Record<number, string>;
  selectedIndexes: number[]; // rows the user actually wants to import
  updatePriceOnDuplicate: boolean;
  cycleId: string | null; // null = do not add to any cycle
};

function pickCell(row: string[], idx: number | undefined): string {
  if (idx === undefined || idx < 0 || idx >= row.length) return "";
  return (row[idx] ?? "").trim();
}

function parsePriceCell(raw: string): number | null {
  if (!raw) return null;
  // tolerate "€ 12,50", "12.50 €", "1.234,56", thin spaces, etc.
  const cleaned = raw
    .replace(/[€\s ]/g, "")
    .replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;
  // if both "." and "," present, last one is the decimal separator
  let normal = cleaned;
  const lastDot = normal.lastIndexOf(".");
  const lastComma = normal.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      normal = normal.replace(/\./g, "").replace(",", ".");
    } else {
      normal = normal.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normal = normal.replace(",", ".");
  }
  const n = parseFloat(normal);
  return Number.isFinite(n) ? n : null;
}

function resolveRow(
  raw: string[],
  index: number,
  columns: string[],
  mapping: Partial<Record<TargetField, number>>,
  emojiOverride: string | undefined,
): { ok: true; row: WizardRow } | { ok: false; reason: string } {
  void columns;
  const name = pickCell(raw, mapping.name);
  if (!name) return { ok: false, reason: "nome mancante" };

  const unitPriceNum = parsePriceCell(pickCell(raw, mapping.unitPrice));
  if (unitPriceNum == null) return { ok: false, reason: "prezzo mancante o non valido" };

  const ppkNum = parsePriceCell(pickCell(raw, mapping.pricePerKg));

  const autoEmoji = getProductEmojiOrNull(name);
  const emoji = (emojiOverride && emojiOverride.trim()) || autoEmoji || "🛒";

  // Category: prefer the file column; when absent, guess from the name among
  // the preset categories (null when unsure, so we never mislabel).
  const fileCategory = pickCell(raw, mapping.category) || null;
  const category = fileCategory ?? guessProductCategory(name);

  return {
    ok: true,
    row: {
      index,
      name,
      variant: pickCell(raw, mapping.variant) || null,
      format: pickCell(raw, mapping.format) || null,
      unitPrice: unitPriceNum.toFixed(2),
      pricePerKg: ppkNum != null ? ppkNum.toFixed(2) : null,
      category,
      categoryGuessed: !fileCategory && category !== null,
      emoji,
      emojiAutoMatched: !emojiOverride && autoEmoji !== null,
      notes: pickCell(raw, mapping.notes) || null,
    },
  };
}

function dedupKey(name: string, variant: string | null, format: string | null): string {
  return [name, variant ?? "", format ?? ""]
    .map((s) => s.toLowerCase().trim())
    .join("|");
}

async function loadExistingCatalogForSupplier(supplierId: string) {
  const db = getDb();
  const rows = await db
    .select({
      catalogProductId: supplierProducts.catalogProductId,
      name: supplierProducts.name,
      variant: supplierProducts.variant,
      format: supplierProducts.format,
      unitPrice: supplierProducts.unitPrice,
    })
    .from(supplierProducts)
    .where(eq(supplierProducts.supplierId, supplierId));
  const map = new Map<string, (typeof rows)[number]>();
  for (const r of rows) map.set(dedupKey(r.name, r.variant, r.format), r);
  return map;
}

export async function adminPreviewSupplierListingImport(
  input: WizardApplyInput,
): Promise<{ data?: { diff: WizardDiffRow[] }; error?: string }> {
  try {
    await requireAdmin();
    if (!input.supplier.existingId && !input.supplier.newName?.trim()) {
      return { error: t.errors.selectOrCreateSupplier };
    }
    if (input.mapping.name === undefined || input.mapping.unitPrice === undefined) {
      return { error: t.errors.mapNameAndPrice };
    }

    const existing = input.supplier.existingId
      ? await loadExistingCatalogForSupplier(input.supplier.existingId)
      : new Map<string, { catalogProductId: string; unitPrice: string; name: string; variant: string | null; format: string | null }>();

    const selected = new Set(input.selectedIndexes);
    const diff: WizardDiffRow[] = [];
    for (let i = 0; i < input.rows.length; i++) {
      if (!selected.has(i)) continue;
      const raw = input.rows[i];
      const resolved = resolveRow(raw, i, input.columns, input.mapping, input.emojiOverrides[i]);
      if (!resolved.ok) {
        diff.push({ kind: "invalid", index: i, raw, reason: resolved.reason });
        continue;
      }
      const row = resolved.row;
      const key = dedupKey(row.name, row.variant, row.format);
      const hit = existing.get(key);
      if (!hit) {
        diff.push({ kind: "new", row });
      } else if (hit.unitPrice === row.unitPrice) {
        diff.push({ kind: "skip_unchanged", row, catalogProductId: hit.catalogProductId });
      } else {
        diff.push({
          kind: "update_price",
          row,
          oldPrice: hit.unitPrice,
          catalogProductId: hit.catalogProductId,
        });
      }
    }
    return { data: { diff } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.importPreviewError };
  }
}

export async function adminApplySupplierListingImport(
  input: WizardApplyInput,
): Promise<{ data?: { added: number; updated: number; skipped: number; invalid: number; addedToCycle: number }; error?: string }> {
  try {
    const admin = await requireAdmin();
    if (input.mapping.name === undefined || input.mapping.unitPrice === undefined) {
      return { error: t.errors.mapNameAndPrice };
    }

    const db = getDb();
    const now = new Date();

    // 1. resolve supplier (existing or freshly created)
    let supplierId = input.supplier.existingId ?? "";
    if (!supplierId) {
      const name = input.supplier.newName?.trim();
      if (!name) return { error: t.errors.supplierNameMissing };
      supplierId = genId("sup");
      await db.insert(suppliers).values({
        supplierId,
        name,
        macroCategory: null,
        contactName: null,
        phone: null,
        email: null,
        address: null,
        notes: null,
        active: true,
        createdAt: now,
      });
      await db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "create_supplier",
        entityType: "supplier",
        entityId: supplierId,
        payloadJson: JSON.stringify({ name, via: "listing_wizard" }),
        createdAt: now,
      });
    }

    // 2. resolve rows and split by action
    const existing = await loadExistingCatalogForSupplier(supplierId);
    const selected = new Set(input.selectedIndexes);

    type Insert = {
      catalogProductId: string;
      row: WizardRow;
    };
    type Update = {
      catalogProductId: string;
      row: WizardRow;
    };
    const inserts: Insert[] = [];
    const updates: Update[] = [];
    let skipped = 0;
    let invalid = 0;

    for (let i = 0; i < input.rows.length; i++) {
      if (!selected.has(i)) continue;
      const resolved = resolveRow(input.rows[i], i, input.columns, input.mapping, input.emojiOverrides[i]);
      if (!resolved.ok) {
        invalid++;
        continue;
      }
      const row = resolved.row;
      const key = dedupKey(row.name, row.variant, row.format);
      const hit = existing.get(key);
      if (!hit) {
        inserts.push({ catalogProductId: genId("cp"), row });
      } else if (hit.unitPrice === row.unitPrice) {
        skipped++;
      } else if (input.updatePriceOnDuplicate) {
        updates.push({ catalogProductId: hit.catalogProductId, row });
      } else {
        skipped++;
      }
    }

    // 3. write to supplier_products
    if (inserts.length) {
      await db.insert(supplierProducts).values(
        inserts.map(({ catalogProductId, row }) => ({
          catalogProductId,
          supplierId,
          name: row.name,
          variant: row.variant,
          format: row.format,
          unit: null,
          unitPrice: row.unitPrice,
          pricePerKg: row.pricePerKg,
          category: row.category,
          emoji: row.emoji || getProductEmoji(row.name),
          notes: row.notes,
          active: true,
          createdAt: now,
        })),
      );
    }
    // One UPDATE per row, but batched into a single HTTP round trip (and a
    // single transaction) instead of one await per row — same pattern as
    // saveOrder. Statement count is unchanged; round trips go N → 1.
    if (updates.length > 0) {
      const updateStatements = updates.map((u) =>
        db
          .update(supplierProducts)
          .set({
            unitPrice: u.row.unitPrice,
            pricePerKg: u.row.pricePerKg,
            category: u.row.category,
            emoji: u.row.emoji,
            notes: u.row.notes,
          })
          .where(eq(supplierProducts.catalogProductId, u.catalogProductId)),
      );
      await db.batch(updateStatements as [(typeof updateStatements)[number], ...typeof updateStatements]);
    }

    // 4. optionally push the same rows into the chosen cycle
    let addedToCycle = 0;
    if (input.cycleId) {
      const cycleRows = [...inserts, ...updates].map(({ row }) => ({
        name: row.name,
        variant: row.variant,
        format: row.format,
        unitPrice: row.unitPrice,
        pricePerKg: row.pricePerKg,
        unit: null,
        supplier: null,
        supplierId,
        notes: row.notes,
        category: row.category,
        emoji: row.emoji,
      }));
      // include even unchanged rows the user explicitly selected, so the
      // "skipped" ones still land in the cycle if missing there
      if (input.updatePriceOnDuplicate === false || true) {
        // load every catalog row matching the user's selection so the cycle
        // can be seeded from the full picked set, not just inserts+updates
        const allKeys = new Set<string>();
        for (let i = 0; i < input.rows.length; i++) {
          if (!selected.has(i)) continue;
          const resolved = resolveRow(input.rows[i], i, input.columns, input.mapping, input.emojiOverrides[i]);
          if (!resolved.ok) continue;
          allKeys.add(dedupKey(resolved.row.name, resolved.row.variant, resolved.row.format));
        }
        // pull skipped rows from the catalog so they go into the cycle too
        for (const [key, hit] of existing.entries()) {
          if (!allKeys.has(key)) continue;
          if (cycleRows.some((r) => dedupKey(r.name, r.variant, r.format) === key)) continue;
          cycleRows.push({
            name: hit.name,
            variant: hit.variant,
            format: hit.format,
            unitPrice: hit.unitPrice,
            pricePerKg: null,
            unit: null,
            supplier: null,
            supplierId,
            notes: null,
            category: null,
            emoji: getProductEmoji(hit.name),
          });
        }
      }
      await upsertCycleProducts(db, input.cycleId, cycleRows);
      addedToCycle = cycleRows.length;
    }

    // 5. audit + revalidate
    await db.insert(auditLog).values({
      auditId: crypto.randomUUID(),
      userEmail: admin.email,
      action: "import_supplier_listing",
      entityType: input.cycleId ? "cycle" : "supplier",
      entityId: input.cycleId ?? supplierId,
      payloadJson: JSON.stringify({
        supplierId,
        added: inserts.length,
        updated: updates.length,
        skipped,
        invalid,
        addedToCycle,
      }),
      createdAt: now,
    });

    revalidatePath("/admin");
    revalidatePath("/ordine");
    return {
      data: {
        added: inserts.length,
        updated: updates.length,
        skipped,
        invalid,
        addedToCycle,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.importApplyError };
  }
}

// Helper used by the wizard UI to keep TARGET_FIELDS in sync without the
// client having to import the heuristics module directly.
export async function adminListImportTargetFields(): Promise<TargetField[]> {
  return TARGET_FIELDS;
}
