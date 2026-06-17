import { and, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/db/client";
import {
  ledgerEntries,
  members,
  orderCycles,
  orders,
  products,
} from "@/lib/db/schema";
import { DISTINTA_FORMAT_VERSION } from "./distinta-builder";
import { parseOds } from "./ods-reader";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";

const EPS = 0.005;

export type DistintaCorrection = {
  orderLineId: string;
  memberId: string;
  memberName: string;
  productId: string;
  productName: string;
  oldTotal: number;
  newTotal: number;
  delta: number; // newTotal - oldTotal (positive = supplier charging more)
};

export type DistintaShippingChange = {
  memberId: string;
  memberName: string;
  oldShipping: number;
  newShipping: number;
};

export type DistintaImportPreview = {
  cycleId: string;
  cycleTitle: string;
  corrections: DistintaCorrection[];
  shippingChanges: DistintaShippingChange[];
  warnings: string[];
  errors: string[];
};

// ── Format-agnostic intermediate shape ──
// Each collector (meta-based for .xlsx/.ods, name-based for .csv) resolves the
// supplier file down to "this (product, member) cell now reads <raw>" plus the
// per-member shipping cells. The shared buildPreviewFromRaw then does all the
// DB diffing, so the three formats converge on one code path.
type RawCorrection = { productId: string; memberId: string; raw: unknown };
type RawShipping = { memberId: string; raw: unknown };
type Collected = {
  cycleId: string;
  cycleTitle: string;
  cells: RawCorrection[];
  shipping: RawShipping[];
  errors: string[];
  warnings: string[];
};

// Reads a number out of a spreadsheet cell. Accepts native numbers, formula
// results, strings with comma/dot decimals, and treats empty/null/missing
// as 0. Returns null only when the value isn't parseable as a number.
function readNumber(value: unknown): number | null {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && value !== null) {
    const v = value as { result?: unknown; value?: unknown };
    if (v.result != null) return readNumber(v.result);
    if (v.value != null) return readNumber(v.value);
    return null;
  }
  const s = String(value).trim().replace("€", "").replace(/\s+/g, "").replace(",", ".");
  if (s === "" || s === "-") return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// A1 ("B2") → 1-based [row, col]. Only handles the simple refs the _meta
// sheet uses (single/double letter column + numeric row).
function a1(ref: string): [number, number] {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`bad A1 ref: ${ref}`);
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return [parseInt(m[2], 10), col];
}

// Diacritic-insensitive, case-insensitive, whitespace-normalized key for
// matching CSV header/label text against DB member and product names.
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ── Shared cell grid abstraction (1-based, exceljs-compatible) ──
interface CellGrid {
  cell(row: number, col: number): unknown;
}
interface SheetSource {
  sheet(name: string): CellGrid | undefined;
}

// ── Collector A: meta-based (.xlsx / .ods) ──
// Reads the hidden `_meta` sheet to map every Distinta cell back to a
// productId/memberId without any name heuristic. This is the robust path —
// the metadata survives both the native .xlsx and a LibreOffice .ods re-save.
export function collectViaMeta(source: SheetSource, expectedCycleId: string): Collected {
  const errors: string[] = [];
  const warnings: string[] = [];
  const empty: Collected = { cycleId: expectedCycleId, cycleTitle: "", cells: [], shipping: [], errors, warnings };

  const meta = source.sheet("_meta");
  const ws = source.sheet("Distinta");
  if (!meta || !ws) {
    errors.push(!meta ? t.errors.distintaMetaSheetMissing : t.errors.distintaSheetMissing);
    return empty;
  }
  const mcell = (ref: string) => meta.cell(...a1(ref));

  const formatVersion = readNumber(mcell("B1"));
  const cycleId = String(mcell("B2") ?? "");
  const cycleTitle = String(mcell("B3") ?? "");
  const productRowStart = readNumber(mcell("B6"));
  const productRowEnd = readNumber(mcell("B7"));
  const shippingRow = readNumber(mcell("B8"));
  const memberColStart = readNumber(mcell("B9"));
  const memberColEnd = readNumber(mcell("B10"));

  if (formatVersion == null || formatVersion !== DISTINTA_FORMAT_VERSION) {
    errors.push(
      `Versione formato distinta non riconosciuta (${formatVersion ?? "nessuna"}). Riscarica la distinta dall'app per ottenere il formato aggiornato.`,
    );
  }
  if (!cycleId) errors.push("cycleId mancante nel foglio _meta.");
  if (cycleId && cycleId !== expectedCycleId) {
    errors.push(
      `Questa distinta è di un ciclo diverso (${cycleTitle || cycleId}). Carica la distinta del ciclo selezionato.`,
    );
  }
  if (
    productRowStart == null ||
    productRowEnd == null ||
    shippingRow == null ||
    memberColStart == null ||
    memberColEnd == null
  ) {
    errors.push(t.errors.distintaMatrixCoordsMissing);
  }
  if (errors.length > 0) return { ...empty, cycleTitle };

  // Read mapping table (row 13+ in _meta).
  const productByRow = new Map<number, string>();
  const memberByCol = new Map<number, string>();
  let mr = 13;
  while (true) {
    const kind = meta.cell(...a1(`A${mr}`));
    if (kind == null || kind === "") break;
    const sheetRow = readNumber(meta.cell(...a1(`B${mr}`)));
    const sheetCol = readNumber(meta.cell(...a1(`C${mr}`)));
    const id = String(meta.cell(...a1(`D${mr}`)) ?? "");
    if (kind === "product" && sheetRow != null && id) {
      productByRow.set(sheetRow, id);
    } else if (kind === "member" && sheetCol != null && id) {
      memberByCol.set(sheetCol, id);
    }
    mr++;
    if (mr > 5000) break; // sanity guard
  }

  if (productByRow.size === 0 || memberByCol.size === 0) {
    errors.push(t.errors.distintaMappingEmpty);
    return { ...empty, cycleId, cycleTitle };
  }

  const cells: RawCorrection[] = [];
  for (const [rowIdx, productId] of productByRow.entries()) {
    for (const [colIdx, memberId] of memberByCol.entries()) {
      cells.push({ productId, memberId, raw: ws.cell(rowIdx, colIdx) });
    }
  }
  const shipping: RawShipping[] = [];
  for (const [colIdx, memberId] of memberByCol.entries()) {
    shipping.push({ memberId, raw: ws.cell(shippingRow!, colIdx) });
  }

  return { cycleId, cycleTitle, cells, shipping, errors, warnings };
}

// ── Collector B: name-based (.csv) ──
// A CSV is a single flat sheet, so the hidden `_meta` sheet is lost on
// "Save as .csv". We fall back to matching the member columns by header name
// and the product rows by name+variant against the DB. Any unmatched or
// ambiguous name becomes a warning and is skipped — never guessed — and the
// admin still reviews the full diff before applying.
async function collectViaCsv(grid: string[][], expectedCycleId: string): Promise<Collected> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const empty: Collected = { cycleId: expectedCycleId, cycleTitle: "", cells: [], shipping: [], errors, warnings };

  // Locate the header row: col 0 == "Prodotto" and a "Totale prodotto" column.
  const headerProduct = norm(t.csv.columnProduct);
  const headerTotal = norm(t.csv.columnTotalProduct);
  const headerNotes = norm(t.csv.columnNotes);
  let headerRow = -1;
  let totalCol = -1;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (norm(row[0] ?? "") !== headerProduct) continue;
    const tc = row.findIndex((c) => norm(c ?? "") === headerTotal);
    if (tc < 0) continue;
    headerRow = r;
    totalCol = tc;
    break;
  }
  if (headerRow < 0) {
    errors.push(t.errors.distintaCsvHeaderMissing);
    return empty;
  }
  const header = grid[headerRow];
  const notesCol = header.findIndex((c) => norm(c ?? "") === headerNotes);
  // Member columns sit between "Note" and "Totale prodotto".
  const memberColStart = (notesCol >= 0 ? notesCol : 5) + 1;
  const memberCols: number[] = [];
  for (let c = memberColStart; c < totalCol; c++) memberCols.push(c);

  // Resolve member columns and product rows against the DB.
  const db = getDb();
  const memberRows = await db.select({ memberId: members.memberId, fullName: members.fullName }).from(members);
  const memberByName = buildNameIndex(memberRows.map((m) => [m.fullName, m.memberId]));

  const productRows = await db
    .select({ productId: products.productId, name: products.name, variant: products.variant })
    .from(products)
    .where(eq(products.cycleId, expectedCycleId));
  const productByKey = buildNameIndex(
    productRows.map((p) => [`${p.name} ${p.variant ?? ""}`, p.productId]),
  );

  // Map each member column → memberId (or skip with a warning).
  const memberIdByCol = new Map<number, string>();
  for (const c of memberCols) {
    const label = (header[c] ?? "").trim();
    if (!label) continue;
    const hit = memberByName.get(norm(label));
    if (hit === AMBIGUOUS) {
      warnings.push(t.errors.distintaCsvMemberAmbiguous(label));
    } else if (!hit) {
      warnings.push(t.errors.distintaCsvMemberUnmatched(label));
    } else {
      memberIdByCol.set(c, hit);
    }
  }

  // Walk product rows until the shipping label or end of grid.
  const shippingLabel = norm(t.csv.shippingLabel);
  const cells: RawCorrection[] = [];
  let shippingGridRow = -1;
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    const first = (row[0] ?? "").trim();
    if (norm(first) === shippingLabel) {
      shippingGridRow = r;
      break;
    }
    if (!first) continue; // blank separator row
    const variant = (row[1] ?? "").trim();
    const key = norm(`${first} ${variant}`);
    const hit = productByKey.get(key);
    if (hit === AMBIGUOUS) {
      warnings.push(t.errors.distintaCsvProductAmbiguous(first));
      continue;
    }
    if (!hit) {
      warnings.push(t.errors.distintaCsvProductUnmatched(first));
      continue;
    }
    for (const [c, memberId] of memberIdByCol.entries()) {
      cells.push({ productId: hit, memberId, raw: row[c] });
    }
  }

  const shipping: RawShipping[] = [];
  if (shippingGridRow >= 0) {
    const row = grid[shippingGridRow];
    for (const [c, memberId] of memberIdByCol.entries()) {
      shipping.push({ memberId, raw: row[c] });
    }
  }

  return { cycleId: expectedCycleId, cycleTitle: "", cells, shipping, errors, warnings };
}

const AMBIGUOUS = Symbol("ambiguous");
// Normalized-name → id index. A name shared by two rows maps to AMBIGUOUS so
// the caller can warn-and-skip rather than silently pick one.
function buildNameIndex(pairs: Array<[string, string]>): Map<string, string | typeof AMBIGUOUS> {
  const m = new Map<string, string | typeof AMBIGUOUS>();
  for (const [name, id] of pairs) {
    const k = norm(name);
    if (!k) continue;
    const existing = m.get(k);
    if (existing === undefined) m.set(k, id);
    else if (existing !== id) m.set(k, AMBIGUOUS);
  }
  return m;
}

// ── Shared DB diff ──
// Given resolved (product, member) → raw value cells, look up the cycle's
// current order/shipping state and produce the correction/shipping diff.
async function buildPreviewFromRaw(c: Collected): Promise<DistintaImportPreview> {
  const { cycleId } = c;
  const warnings = [...c.warnings];
  const errors = [...c.errors];
  if (errors.length > 0) {
    return { cycleId, cycleTitle: c.cycleTitle, corrections: [], shippingChanges: [], warnings, errors };
  }

  const db = getDb();

  const [cycle] = await db
    .select({ cycleId: orderCycles.cycleId, title: orderCycles.title, status: orderCycles.status })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!cycle) {
    errors.push(t.errors.cycleNoLongerInDb);
    return { cycleId, cycleTitle: c.cycleTitle, corrections: [], shippingChanges: [], warnings, errors };
  }
  if (cycle.status !== "closed") {
    errors.push(t.errors.cycleNotClosedDistinta);
    return { cycleId, cycleTitle: cycle.title, corrections: [], shippingChanges: [], warnings, errors };
  }

  const lines = await db
    .select({
      orderLineId: orders.orderLineId,
      memberId: orders.memberId,
      productId: orders.productId,
      lineTotal: orders.lineTotal,
      actualLineTotal: orders.actualLineTotal,
      productName: products.name,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.productId))
    .where(eq(orders.cycleId, cycleId));
  const linesByKey = new Map<string, (typeof lines)[number]>();
  for (const l of lines) linesByKey.set(`${l.productId}::${l.memberId}`, l);

  const memberRows = await db.select({ memberId: members.memberId, fullName: members.fullName }).from(members);
  const memberNameById = new Map(memberRows.map((m) => [m.memberId, m.fullName]));
  const productNameById = new Map<string, string>();
  for (const l of lines) productNameById.set(l.productId, l.productName);

  const shippingRows = await db
    .select({ memberId: ledgerEntries.memberId, amount: ledgerEntries.amount })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.cycleId, cycleId), eq(ledgerEntries.type, "shipping_charge")));
  const shippingByMember = new Map<string, number>(
    shippingRows.map((s) => [s.memberId, Math.abs(parseFloat(s.amount))]),
  );

  // ── Corrections ──
  const corrections: DistintaCorrection[] = [];
  for (const { productId, memberId, raw } of c.cells) {
    const productName = productNameById.get(productId) ?? productId;
    const memberName = memberNameById.get(memberId) ?? memberId;
    const newTotal = readNumber(raw);
    const existing = linesByKey.get(`${productId}::${memberId}`);

    if (!existing) {
      if (newTotal != null && Math.abs(newTotal) >= EPS) {
        warnings.push(t.errors.distintaWarningNoOrder(memberName, productName, formatMoney(newTotal)));
      }
      continue;
    }
    if (newTotal == null) {
      warnings.push(`${memberName} · ${productName}: valore non leggibile come numero — ignorato.`);
      continue;
    }
    const currentEffective =
      existing.actualLineTotal != null
        ? parseFloat(existing.actualLineTotal)
        : parseFloat(existing.lineTotal);
    if (Math.abs(newTotal - currentEffective) < EPS) continue;

    corrections.push({
      orderLineId: existing.orderLineId,
      memberId,
      memberName,
      productId,
      productName,
      oldTotal: currentEffective,
      newTotal,
      delta: newTotal - currentEffective,
    });
  }

  // ── Shipping ──
  const shippingChanges: DistintaShippingChange[] = [];
  for (const { memberId, raw } of c.shipping) {
    const newShipping = readNumber(raw);
    if (newShipping == null) continue;
    const oldShipping = shippingByMember.get(memberId) ?? 0;
    if (Math.abs(newShipping - oldShipping) < EPS) continue;
    const memberName = memberNameById.get(memberId) ?? memberId;
    shippingChanges.push({ memberId, memberName, oldShipping, newShipping });
  }

  return { cycleId, cycleTitle: cycle.title, corrections, shippingChanges, warnings, errors };
}

// ── exceljs adapter (.xlsx) ──
function excelSource(wb: ExcelJS.Workbook): SheetSource {
  return {
    sheet(name) {
      const ws = wb.getWorksheet(name);
      if (!ws) return undefined;
      return { cell: (row, col) => ws.getCell(row, col).value };
    },
  };
}

// ── CSV text → 2D array ──
// Detects the delimiter (LibreOffice/Excel emit either ',' or ';' depending on
// locale) and parses RFC4180-style quoting.
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of clean) if (ch in counts) counts[ch]++;
  const delim = (["," , ";", "\t"] as const).reduce((a, b) => (counts[b] > counts[a] ? b : a), ",");

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (ch === "\r") {
      // swallow; \n handles the row break
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Picks the collector by file format. Extension drives detection; if absent we
// sniff the magic bytes (zip → .xlsx/.ods, otherwise text → .csv).
function detectFormat(fileBuffer: Buffer, fileName?: string): "xlsx" | "ods" | "csv" {
  const ext = fileName?.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === "csv") return "csv";
  if (ext === "ods") return "ods";
  if (ext === "xlsx") return "xlsx";
  // No / unknown extension: sniff. Both xlsx and ods are zip ("PK\x03\x04").
  const isZip = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b;
  if (!isZip) return "csv";
  // ODS zips carry a "mimetype" entry naming opendocument; xlsx does not.
  return fileBuffer.includes(Buffer.from("opendocument.spreadsheet")) ? "ods" : "xlsx";
}

export async function parseSupplierDistinta(
  fileBuffer: Buffer,
  expectedCycleId: string,
  fileName?: string,
): Promise<DistintaImportPreview> {
  const format = detectFormat(fileBuffer, fileName);
  const openError = (e: unknown): DistintaImportPreview => ({
    cycleId: expectedCycleId,
    cycleTitle: "",
    corrections: [],
    shippingChanges: [],
    warnings: [],
    errors: [t.errors.distintaOpenError(e instanceof Error ? e.message : "errore sconosciuto")],
  });

  try {
    if (format === "csv") {
      const grid = parseCsv(fileBuffer.toString("utf8"));
      return await buildPreviewFromRaw(await collectViaCsv(grid, expectedCycleId));
    }
    if (format === "ods") {
      const wb = parseOds(fileBuffer);
      return await buildPreviewFromRaw(collectViaMeta(wb, expectedCycleId));
    }
    const wb = new ExcelJS.Workbook();
    // The exceljs typings predate @types/node's generic Buffer<ArrayBufferLike>;
    // the value is bit-for-bit fine, only the structural type check trips.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(fileBuffer as any);
    return await buildPreviewFromRaw(collectViaMeta(excelSource(wb), expectedCycleId));
  } catch (e) {
    return openError(e);
  }
}
