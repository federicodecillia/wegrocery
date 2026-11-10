"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { requireOrderManager } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { getDb } from "@/lib/db/client";
import { supplierProducts, auditLog, suppliers } from "@/lib/db/schema";
import {
  getProductEmoji,
  guessProductCategory,
  isGenericCategoryLabel,
} from "@/lib/utils";
import { buildProductTemplate, parseProductTemplate } from "@/lib/csv/product-template";
import { inspectListing, pickSupplierMatch, type ListingInspection } from "@/lib/csv/supplier-listing-parser";
import { hasSharedColumn, suggestMapping, type TargetField } from "@/lib/csv/header-heuristics";
import { parsePriceCell, resolvePricePerKg } from "@/lib/csv/pack-weight";
import { upsertCycleProducts } from "@/lib/db/cycle-products";
import { parseLimitCell, setProductLimits } from "@/lib/products/stock";
import { decodeUploadBase64 } from "@/lib/upload-limit";
import { isChosenEmoji, productEmojiKey, resolveProductEmoji } from "@/lib/products/emoji";
import { applyProductEmojiEverywhere, loadSavedProductEmojis } from "@/lib/db/product-emoji";

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export async function adminImportProductsCsv(supplierId: string, csvText: string) {
  try {
    const admin = await requireOrderManager();
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

    const savedEmojis = await loadSavedProductEmojis(
      db,
      rows.map((r) => r.split(/[;,]/)[0]?.trim().replace(/^"(.*)"$/, "$1") ?? ""),
    );

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
        emoji = resolveProductEmoji(name, columns[6], savedEmojis.get(productEmojiKey(name))).emoji;
        notes = columns[7] || null;
      } else {
        // New: Nome; Varietà; Formato; Prezzo; Prezzo/kg; Categoria; Icona; Note
        unitPriceStr = (columns[3] || "").replace(",", ".");
        const ppk = (columns[4] || "").replace(",", ".");
        pricePerKgStr = ppk && !isNaN(parseFloat(ppk)) ? parseFloat(ppk).toFixed(2) : null;
        category = columns[5] || null;
        emoji = resolveProductEmoji(name, columns[6], savedEmojis.get(productEmojiKey(name))).emoji;
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
    await requireOrderManager();
    const buf = await buildProductTemplate();
    return { base64: buf.toString("base64"), filename: "template_prodotti.xlsx" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.generationError };
  }
}

export async function adminImportProductsXlsx(supplierId: string, base64: string) {
  try {
    const admin = await requireOrderManager();
    const db = getDb();
    const now = new Date();

    if (!supplierId) return { error: t.errors.fieldRequired(t.fields.supplier) };
    const buf = decodeUploadBase64(base64);
    const rows = await parseProductTemplate(buf);
    if (rows.length === 0) return { error: t.errors.csvInvalid };

    const savedEmojis = await loadSavedProductEmojis(db, rows.map((r) => r.name));
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
      emoji: resolveProductEmoji(r.name, r.emoji, savedEmojis.get(productEmojiKey(r.name))).emoji,
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
// Two actions: inspect (step 1) and apply (commit); the diff preview between
// the two is computed client-side by the wizard component.
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
    await requireOrderManager();
    if (!filename || !base64) return { error: t.errors.fileMissing };

    const buf = decodeUploadBase64(base64);
    // A corrupted/mis-typed file makes ExcelJS throw with a raw English
    // message; the wizard shows server errors as-is, so translate parse
    // failures here instead of leaking the library string to the admin.
    // (decodeUploadBase64 stays OUTSIDE the try: its size-cap error is
    // already localized and must not be masked as "unreadable".)
    let inspection: ListingInspection;
    try {
      inspection = await inspectListing(buf, filename);
    } catch {
      return { error: t.errors.fileEmptyOrUnreadable };
    }
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
  /** Limited quantities from the file: applied only to an import into a cycle. */
  maxQuantity: number | null;
  maxPerMember: number | null;
};

export type WizardApplyInput = {
  supplier: { existingId?: string; newName?: string };
  columns: string[];
  rows: string[][];
  mapping: Partial<Record<TargetField, number>>;
  emojiOverrides: Record<number, string>;
  selectedIndexes: number[]; // rows the user actually wants to import
  updatePriceOnDuplicate: boolean;
  cycleId: string | null; // null = do not add to any cycle
  // Price per kg from the pack weight in the format or name
  // (lib/csv/pack-weight.ts): for rows the file leaves empty, and in place
  // of file values equal to the pack price.
  computePricePerKg?: boolean;
  replaceSuspectPricePerKg?: boolean;
};

type PricePerKgOptions = { computeWhenMissing: boolean; replaceSuspect: boolean };

function pickLimit(row: string[], idx: number | undefined, min: number, max: number): number | null {
  return parseLimitCell(pickCell(row, idx), min, max);
}

function pickCell(row: string[], idx: number | undefined): string {
  if (idx === undefined || idx < 0 || idx >= row.length) return "";
  return (row[idx] ?? "").trim();
}

function resolveRow(
  raw: string[],
  index: number,
  columns: string[],
  mapping: Partial<Record<TargetField, number>>,
  emojiOverride: string | undefined,
  ppkOptions: PricePerKgOptions,
  savedEmojis?: ReadonlyMap<string, string>,
): { ok: true; row: WizardRow } | { ok: false; reason: string } {
  void columns;
  const name = pickCell(raw, mapping.name);
  if (!name) return { ok: false, reason: "nome mancante" };

  const unitPriceNum = parsePriceCell(pickCell(raw, mapping.unitPrice));
  if (unitPriceNum == null) return { ok: false, reason: "prezzo mancante o non valido" };

  const format = pickCell(raw, mapping.format) || null;
  const ppkNum = resolvePricePerKg({
    unitPrice: unitPriceNum,
    filePricePerKg: parsePriceCell(pickCell(raw, mapping.pricePerKg)),
    format,
    name,
    ...ppkOptions,
  }).value;

  const { emoji, source: emojiSource } = resolveProductEmoji(
    name,
    emojiOverride,
    savedEmojis?.get(productEmojiKey(name)),
  );

  // Category: the deterministic guess from the name wins whenever it
  // recognizes the product, so the same product always lands in the same
  // preset category — a supplier's own free-text column is filled
  // inconsistently row to row (the same "Cicoria" landing in Verdura on one
  // row and Altro on another, depending on which file/batch it came from,
  // is exactly this). Fall back to the file's column when the guess is
  // unsure, unless it's a catch-all like "Altro"/"Varie" a supplier uses
  // for anything it didn't bother sub-categorizing.
  const fileCategoryRaw = pickCell(raw, mapping.category) || null;
  const fileCategory =
    fileCategoryRaw && !isGenericCategoryLabel(fileCategoryRaw) ? fileCategoryRaw : null;
  const guessedCategory = guessProductCategory(name);
  const category = guessedCategory ?? fileCategory;

  return {
    ok: true,
    row: {
      index,
      name,
      variant: pickCell(raw, mapping.variant) || null,
      format,
      unitPrice: unitPriceNum.toFixed(2),
      pricePerKg: ppkNum != null ? ppkNum.toFixed(2) : null,
      category,
      categoryGuessed: guessedCategory !== null,
      emoji,
      emojiAutoMatched: emojiSource === "name",
      notes: pickCell(raw, mapping.notes) || null,
      maxQuantity: pickLimit(raw, mapping.maxQuantity, 0, 99999),
      maxPerMember: pickLimit(raw, mapping.maxPerMember, 1, 9999),
    },
  };
}

function dedupKey(name: string, variant: string | null, format: string | null): string {
  return [name, variant ?? "", format ?? ""]
    .map((s) => s.toLowerCase().trim())
    .join("|");
}

type CatalogHit = Awaited<ReturnType<typeof loadExistingCatalogForSupplier>> extends Map<string, infer V> ? V : never;

async function loadExistingCatalogForSupplier(supplierId: string) {
  const db = getDb();
  const rows = await db
    .select({
      catalogProductId: supplierProducts.catalogProductId,
      name: supplierProducts.name,
      variant: supplierProducts.variant,
      format: supplierProducts.format,
      unitPrice: supplierProducts.unitPrice,
      pricePerKg: supplierProducts.pricePerKg,
      emoji: supplierProducts.emoji,
    })
    .from(supplierProducts)
    .where(eq(supplierProducts.supplierId, supplierId));
  const map = new Map<string, (typeof rows)[number]>();
  for (const r of rows) map.set(dedupKey(r.name, r.variant, r.format), r);
  return map;
}

// The file's "Disponibili" and "Massimo per socio" on the cycle's products,
// matched by name, variant and format. A column left out keeps what the
// product has; units below what is already sold are refused (setProductLimits)
// and only counted.
async function applyFileLimits(
  db: ReturnType<typeof getDb>,
  input: WizardApplyInput,
  selected: Set<number>,
  ppkOptions: PricePerKgOptions,
): Promise<{ limitsSet: number; limitsBelowSold: number }> {
  const result = { limitsSet: 0, limitsBelowSold: 0 };
  if (!input.cycleId || (input.mapping.maxQuantity === undefined && input.mapping.maxPerMember === undefined)) return result;
  const wanted = new Map<string, { maxQuantity: number | null; maxPerMember: number | null }>();
  for (let i = 0; i < input.rows.length; i++) {
    if (!selected.has(i)) continue;
    const resolved = resolveRow(input.rows[i], i, input.columns, input.mapping, input.emojiOverrides[i], ppkOptions);
    if (!resolved.ok || (resolved.row.maxQuantity === null && resolved.row.maxPerMember === null)) continue;
    const { name, variant, format, maxQuantity, maxPerMember } = resolved.row;
    wanted.set(dedupKey(name, variant, format), { maxQuantity, maxPerMember });
  }
  if (wanted.size === 0) return result;
  const { rows } = await db.execute<{
    product_id: string;
    name: string;
    variant: string | null;
    format: string | null;
    max_quantity: number | null;
    max_per_member: number | null;
  }>(sql`SELECT product_id, name, variant, format, max_quantity, max_per_member FROM products WHERE cycle_id = ${input.cycleId}`);
  for (const p of rows) {
    const w = wanted.get(dedupKey(p.name, p.variant, p.format));
    if (!w) continue;
    const res = await setProductLimits(db, {
      productId: p.product_id,
      maxQuantity: w.maxQuantity ?? p.max_quantity,
      maxPerMember: w.maxPerMember ?? p.max_per_member,
    });
    if (res.ok) result.limitsSet++;
    else result.limitsBelowSold++;
  }
  return result;
}

export async function adminApplySupplierListingImport(
  input: WizardApplyInput,
): Promise<{
  data?: { added: number; updated: number; skipped: number; invalid: number; addedToCycle: number; limitsSet: number; limitsBelowSold: number };
  error?: string;
}> {
  try {
    const admin = await requireOrderManager();
    if (input.mapping.name === undefined || input.mapping.unitPrice === undefined) {
      return { error: t.errors.mapNameAndPrice };
    }
    if (hasSharedColumn(input.mapping)) {
      return { error: t.errors.mapSharedColumn };
    }
    const ppkOptions: PricePerKgOptions = {
      computeWhenMissing: input.computePricePerKg === true,
      replaceSuspect: input.replaceSuspectPricePerKg === true,
    };

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
    // The icons the group already uses for these names: an import keeps them
    // unless the admin picks another one in the preview.
    const savedEmojis = await loadSavedProductEmojis(
      db,
      input.selectedIndexes.map((i) => pickCell(input.rows[i] ?? [], input.mapping.name)),
    );

    type Insert = {
      catalogProductId: string;
      row: WizardRow;
    };
    type Update = {
      catalogProductId: string;
      row: WizardRow;
    };
    type Skip = {
      hit: CatalogHit;
      row: WizardRow;
    };
    const inserts: Insert[] = [];
    const updates: Update[] = [];
    const skippedRows: Skip[] = [];
    // Icons the admin picked in the preview, by product name (last pick wins).
    const pickedEmojis = new Map<string, { name: string; emoji: string }>();
    let skipped = 0;
    let invalid = 0;

    for (let i = 0; i < input.rows.length; i++) {
      if (!selected.has(i)) continue;
      const override = input.emojiOverrides[i]?.trim() || undefined;
      const resolved = resolveRow(input.rows[i], i, input.columns, input.mapping, override, ppkOptions, savedEmojis);
      if (!resolved.ok) {
        invalid++;
        continue;
      }
      const row = resolved.row;
      if (override) pickedEmojis.set(productEmojiKey(row.name), { name: row.name, emoji: override });
      const key = dedupKey(row.name, row.variant, row.format);
      const hit = existing.get(key);
      // The same product already in this supplier's catalogue keeps its own
      // icon, unless the admin picked one in the preview.
      if (hit && !override && isChosenEmoji(hit.emoji)) row.emoji = hit.emoji.trim();
      if (!hit) {
        inserts.push({ catalogProductId: genId("cp"), row });
      } else if (hit.unitPrice === row.unitPrice && (hit.pricePerKg ?? null) === row.pricePerKg) {
        skipped++;
        skippedRows.push({ hit, row });
      } else if (input.updatePriceOnDuplicate) {
        updates.push({ catalogProductId: hit.catalogProductId, row });
      } else {
        skipped++;
        skippedRows.push({ hit, row });
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
    // A skipped row (same price) still fixes a catalogue icon left on the
    // cart when the group already uses a real one for that name.
    const iconFixes = skippedRows.filter(
      ({ hit, row }) => isChosenEmoji(row.emoji) && (hit.emoji ?? "").trim() !== row.emoji,
    );
    if (iconFixes.length > 0) {
      const iconStatements = iconFixes.map(({ hit, row }) =>
        db
          .update(supplierProducts)
          .set({ emoji: row.emoji })
          .where(eq(supplierProducts.catalogProductId, hit.catalogProductId)),
      );
      await db.batch(iconStatements as [(typeof iconStatements)[number], ...typeof iconStatements]);
    }

    // 4. optionally push the same rows into the chosen cycle
    let addedToCycle = 0;
    let limitsSet = 0;
    let limitsBelowSold = 0;
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
      // Rows skipped in the catalogue (same price) still land in the cycle
      // the admin picked, at the catalogue's price, with the row's icon.
      for (const { hit, row } of skippedRows) {
        const key = dedupKey(hit.name, hit.variant, hit.format);
        if (cycleRows.some((r) => dedupKey(r.name, r.variant, r.format) === key)) continue;
        cycleRows.push({
          name: hit.name,
          variant: hit.variant,
          format: hit.format,
          unitPrice: hit.unitPrice,
          pricePerKg: hit.pricePerKg,
          unit: null,
          supplier: null,
          supplierId,
          notes: null,
          category: null,
          emoji: row.emoji,
        });
      }
      await upsertCycleProducts(db, input.cycleId, cycleRows);
      addedToCycle = cycleRows.length;
      ({ limitsSet, limitsBelowSold } = await applyFileLimits(db, input, selected, ppkOptions));
    }

    // 5. an icon picked in the preview becomes the icon of every product with
    // that name: other suppliers' catalogues and every cycle, this one too.
    let iconsChanged = 0;
    for (const { name, emoji } of pickedEmojis.values()) {
      const changed = await applyProductEmojiEverywhere(db, name, emoji);
      iconsChanged += changed.catalog + changed.cycles;
    }

    // 6. audit + revalidate
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
        limitsSet,
        limitsBelowSold,
        iconsPicked: pickedEmojis.size,
        iconsChanged,
      }),
      createdAt: now,
    });

    revalidatePath("/admin");
    revalidatePath("/ordine");
    // A changed icon shows on Home, history, calendar and the public page too.
    if (iconsChanged > 0) revalidatePath("/", "layout");
    return {
      data: {
        added: inserts.length,
        updated: updates.length,
        skipped,
        invalid,
        addedToCycle,
        limitsSet,
        limitsBelowSold,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.importApplyError };
  }
}

// The icons the group already uses for these product names (keyed by
// productEmojiKey), so the import preview shows the icon the import will keep.
export async function adminSavedProductEmojis(
  names: string[],
): Promise<{ data?: Record<string, string>; error?: string }> {
  try {
    await requireOrderManager();
    const list = Array.isArray(names) ? names.filter((n) => typeof n === "string").slice(0, 5000) : [];
    const saved = await loadSavedProductEmojis(getDb(), list);
    return { data: Object.fromEntries(saved) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.genericError };
  }
}
