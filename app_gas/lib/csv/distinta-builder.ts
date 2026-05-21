import { and, asc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/db/client";
import {
  ledgerEntries,
  members,
  orderCycles,
  orders,
  products,
  suppliers,
} from "@/lib/db/schema";

// File format version: bump if the layout/_meta schema changes in a way
// that breaks the parser. Stored in _meta!B1 and checked on import.
export const DISTINTA_FORMAT_VERSION = 1;

// Yellow fill for the cells the supplier is meant to edit.
const FILL_EDITABLE = "FFFFF7D6";
// Green fill for derived totals (formulas) — visually marks them as
// "don't type here, this is auto".
const FILL_TOTAL = "FFE6F4EA";
// Grey for the locked reference columns / header.
const FILL_REF = "FFF1EFEA";
const FILL_HEADER = "FF2D2B29";

const slug = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "ciclo";

// Excel column letter for a 1-based column number (1 → A, 27 → AA, etc.)
function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

type Row = {
  orderLineId: string;
  memberId: string;
  memberName: string;
  productId: string;
  productName: string;
  variant: string | null;
  format: string | null;
  unit: string | null;
  unitPrice: string;
  pricePerKg: string | null;
  notes: string | null;
  quantity: number;
  lineTotal: string;
  actualLineTotal: string | null;
};

// Legacy "Unità" field was often saved as the literal "1" (placeholder).
// Treat it as no unit so we can show "Ordinato: 2" instead of "Ordinato: 2 1".
function realUnit(unit: string | null | undefined): string {
  const u = (unit ?? "").trim();
  return u === "" || u === "1" ? "" : u;
}

export type DistintaBuildResult = {
  filename: string;
  content: Buffer;
  productCount: number;
  memberCount: number;
  grandTotal: number;
};

// Builds the round-trip distinta workbook for a closed cycle.
// Layout (Distinta sheet):
//   R1: cycle title (merged across all columns)
//   R2: instructions for the supplier (merged)
//   R3: blank
//   R4: header row (Prodotto · Varietà · Formato · €/pz · €/kg · Note · <SOCIO1>...<SOCIO N> · Totale prodotto)
//   R5..R(5+P-1): one row per product with at least one ordered cell
//   blank row
//   Shipping row: "Spedizione" with one yellow cell per member (pre-filled from current shipping_charge)
//   blank row
//   Total-per-member row: SUM formulas (one per member column + grand total)
//
// Hidden _meta sheet carries the cycleId + (rowIndex → productId) and
// (colLetter → memberId) mappings so the parser can round-trip without
// any name-based heuristic.
export async function buildSupplierDistinta(cycleId: string): Promise<DistintaBuildResult> {
  const db = getDb();

  const [cycle] = await db
    .select({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      pickupDate: orderCycles.pickupDate,
      supplierId: orderCycles.supplierId,
      supplierName: suppliers.name,
    })
    .from(orderCycles)
    .leftJoin(suppliers, eq(orderCycles.supplierId, suppliers.supplierId))
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!cycle) throw new Error("Ciclo non trovato");

  // All order lines for the cycle, joined with member and product metadata.
  // Sorted by product (sortOrder, name) then member full name so the matrix
  // reads naturally.
  const rows = (await db
    .select({
      orderLineId: orders.orderLineId,
      memberId: orders.memberId,
      memberName: members.fullName,
      productId: products.productId,
      productName: products.name,
      variant: products.variant,
      format: products.format,
      unit: products.unit,
      unitPrice: orders.unitPriceSnapshot,
      pricePerKg: products.pricePerKg,
      notes: products.notes,
      quantity: orders.quantity,
      lineTotal: orders.lineTotal,
      actualLineTotal: orders.actualLineTotal,
    })
    .from(orders)
    .innerJoin(members, eq(orders.memberId, members.memberId))
    .innerJoin(products, eq(orders.productId, products.productId))
    .where(eq(orders.cycleId, cycleId))
    .orderBy(asc(products.sortOrder), asc(products.name), asc(members.fullName))) as Row[];

  if (rows.length === 0) {
    throw new Error("Nessun ordine in questo ciclo");
  }

  // Per-member shipping currently on file (absolute value — ledger stores
  // it as a negative charge).
  const shippingRows = await db
    .select({ memberId: ledgerEntries.memberId, amount: ledgerEntries.amount })
    .from(ledgerEntries)
    .where(
      and(eq(ledgerEntries.cycleId, cycleId), eq(ledgerEntries.type, "shipping_charge")),
    );
  const shippingByMember = new Map<string, number>(
    shippingRows.map((r) => [r.memberId, Math.abs(parseFloat(r.amount))]),
  );

  // Build ordered product + member lists.
  const productOrder: string[] = [];
  const productMeta = new Map<string, Row>();
  const memberOrder: string[] = [];
  const memberName = new Map<string, string>();
  for (const r of rows) {
    if (!productMeta.has(r.productId)) {
      productOrder.push(r.productId);
      productMeta.set(r.productId, r);
    }
    if (!memberName.has(r.memberId)) {
      memberOrder.push(r.memberId);
      memberName.set(r.memberId, r.memberName);
    }
  }
  memberOrder.sort((a, b) => (memberName.get(a) ?? "").localeCompare(memberName.get(b) ?? ""));
  // Include members who only have shipping but no orders (rare, but possible
  // after an admin edit). Append them at the end so the column order stays
  // stable for ones that did order.
  for (const mid of shippingByMember.keys()) {
    if (!memberName.has(mid)) {
      memberOrder.push(mid);
      memberName.set(mid, "—");
    }
  }

  // Original line totals indexed by (productId, memberId) for fast lookup.
  const lineByKey = new Map<string, Row>();
  for (const r of rows) lineByKey.set(`${r.productId}::${r.memberId}`, r);

  // ── Workbook ──
  const wb = new ExcelJS.Workbook();
  wb.creator = "Porta Moneta GAS";
  wb.created = new Date();

  // ── Distinta sheet ──
  const ws = wb.addWorksheet("Distinta", {
    views: [{ state: "frozen", xSplit: 6, ySplit: 4 }],
  });

  // Column layout: 6 reference columns + N member columns + 1 total column.
  const REF_COLS = 6;
  const memberColStart = REF_COLS + 1; // 7 → G
  const memberColEnd = REF_COLS + memberOrder.length; // 6 + N
  const totalCol = memberColEnd + 1;
  const lastCol = totalCol;

  // R1: title — merged
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${cycle.title} — Distinta fornitore${cycle.supplierName ? ` (${cycle.supplierName})` : ""}`;
  titleCell.font = { name: "Calibri", size: 14, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };

  // R2: instructions — merged
  ws.mergeCells(2, 1, 2, lastCol);
  const instrCell = ws.getCell(2, 1);
  instrCell.value =
    "Compila le celle gialle con il costo effettivo (in euro) per ciascun socio. La riga \"Spedizione\" e il \"Totale per socio\" sono auto-calcolati. Non rinominare le colonne soci né eliminare il foglio _meta — servono per ricaricare la distinta nell'app.";
  instrCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF555555" } };
  instrCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  ws.getRow(2).height = 36;

  // R4: header
  const HEADER_ROW = 4;
  const headers = [
    "Prodotto",
    "Varietà",
    "Formato",
    "€/pz",
    "€/kg",
    "Note",
    ...memberOrder.map((mid) => memberName.get(mid) ?? "—"),
    "Totale prodotto",
  ];
  for (let i = 0; i < headers.length; i++) {
    const c = ws.getCell(HEADER_ROW, i + 1);
    c.value = headers[i];
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_HEADER } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: "FF888888" } } };
  }
  ws.getRow(HEADER_ROW).height = 32;

  // Column widths
  ws.getColumn(1).width = 22; // Prodotto
  ws.getColumn(2).width = 16; // Varietà
  ws.getColumn(3).width = 10; // Formato
  ws.getColumn(4).width = 8;  // €/pz
  ws.getColumn(5).width = 8;  // €/kg
  ws.getColumn(6).width = 22; // Note
  for (let i = memberColStart; i <= memberColEnd; i++) ws.getColumn(i).width = 11;
  ws.getColumn(totalCol).width = 14;

  // ── Product rows ──
  const PRODUCT_ROW_START = HEADER_ROW + 1;
  let r = PRODUCT_ROW_START;
  for (const pid of productOrder) {
    const meta = productMeta.get(pid)!;
    ws.getCell(r, 1).value = meta.productName;
    ws.getCell(r, 2).value = meta.variant ?? "";
    ws.getCell(r, 3).value = meta.format ?? "";
    ws.getCell(r, 4).value = parseFloat(meta.unitPrice);
    ws.getCell(r, 4).numFmt = "0.00";
    if (meta.pricePerKg) {
      ws.getCell(r, 5).value = parseFloat(meta.pricePerKg);
      ws.getCell(r, 5).numFmt = "0.00";
    }
    ws.getCell(r, 6).value = meta.notes ?? "";

    // Reference cells (left of the matrix) — locked + grey.
    for (let c = 1; c <= REF_COLS; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_REF } };
      cell.alignment = { vertical: "middle", horizontal: c <= 3 ? "left" : "right" };
      cell.protection = { locked: true };
    }

    // Member cells — yellow + editable. Pre-fill with original line total
    // (or the existing actualLineTotal if a rectification was already made).
    // Attach a cell note with the ordered quantity so the supplier sees
    // the reference on hover ("Ordinato: 2 kg") without polluting the
    // editable numeric cell value.
    const unit = realUnit(meta.unit);
    for (let i = 0; i < memberOrder.length; i++) {
      const mid = memberOrder[i];
      const cell = ws.getCell(r, memberColStart + i);
      const line = lineByKey.get(`${pid}::${mid}`);
      if (line) {
        const v = line.actualLineTotal != null
          ? parseFloat(line.actualLineTotal)
          : parseFloat(line.lineTotal);
        cell.value = v;
        cell.numFmt = "0.00";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_EDITABLE } };
        cell.protection = { locked: false };
        const qtyLabel = unit ? `${line.quantity} ${unit}` : `${line.quantity} pz`;
        cell.note = `Ordinato: ${qtyLabel}`;
      } else {
        // No order from this member for this product: leave blank, lock it
        // so the supplier can't accidentally type into it (any value goes
        // into "warnings" on import anyway).
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_REF } };
        cell.protection = { locked: true };
      }
      cell.alignment = { vertical: "middle", horizontal: "right" };
    }

    // Total-per-product formula — sums the member cells on this row.
    const startLetter = colLetter(memberColStart);
    const endLetter = colLetter(memberColEnd);
    const totalCell = ws.getCell(r, totalCol);
    totalCell.value = { formula: `SUM(${startLetter}${r}:${endLetter}${r})` };
    totalCell.numFmt = "0.00";
    totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_TOTAL } };
    totalCell.font = { bold: true };
    totalCell.alignment = { vertical: "middle", horizontal: "right" };
    totalCell.protection = { locked: true };

    r++;
  }
  const PRODUCT_ROW_END = r - 1;

  // ── Blank row ──
  r++;

  // ── Shipping row ──
  const SHIPPING_ROW = r;
  ws.getCell(r, 1).value = "Spedizione";
  ws.getCell(r, 1).font = { bold: true };
  ws.mergeCells(r, 1, r, REF_COLS);
  for (let c = 1; c <= REF_COLS; c++) {
    ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_REF } };
    ws.getCell(r, c).protection = { locked: true };
  }
  ws.getCell(r, 1).alignment = { vertical: "middle", horizontal: "left" };
  for (let i = 0; i < memberOrder.length; i++) {
    const mid = memberOrder[i];
    const cell = ws.getCell(r, memberColStart + i);
    const v = shippingByMember.get(mid) ?? 0;
    cell.value = v;
    cell.numFmt = "0.00";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_EDITABLE } };
    cell.protection = { locked: false };
    cell.alignment = { vertical: "middle", horizontal: "right" };
  }
  // Shipping total per cycle (sum across members)
  {
    const startLetter = colLetter(memberColStart);
    const endLetter = colLetter(memberColEnd);
    const totalCell = ws.getCell(r, totalCol);
    totalCell.value = { formula: `SUM(${startLetter}${r}:${endLetter}${r})` };
    totalCell.numFmt = "0.00";
    totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_TOTAL } };
    totalCell.font = { bold: true };
    totalCell.alignment = { vertical: "middle", horizontal: "right" };
    totalCell.protection = { locked: true };
  }
  r++;

  // ── Blank row ──
  r++;

  // ── Total-per-member row (formulas) ──
  const TOTAL_ROW = r;
  ws.getCell(r, 1).value = "Totale per socio";
  ws.getCell(r, 1).font = { bold: true };
  ws.mergeCells(r, 1, r, REF_COLS);
  for (let c = 1; c <= REF_COLS; c++) {
    ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_TOTAL } };
    ws.getCell(r, c).protection = { locked: true };
  }
  ws.getCell(r, 1).alignment = { vertical: "middle", horizontal: "left" };
  for (let i = 0; i < memberOrder.length; i++) {
    const letter = colLetter(memberColStart + i);
    const cell = ws.getCell(r, memberColStart + i);
    // SUM of (product rows + shipping row) in this member column.
    cell.value = {
      formula: `SUM(${letter}${PRODUCT_ROW_START}:${letter}${PRODUCT_ROW_END})+${letter}${SHIPPING_ROW}`,
    };
    cell.numFmt = "0.00";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_TOTAL } };
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "right" };
    cell.protection = { locked: true };
  }
  // Grand total
  {
    const startLetter = colLetter(memberColStart);
    const endLetter = colLetter(memberColEnd);
    const cell = ws.getCell(r, totalCol);
    cell.value = { formula: `SUM(${startLetter}${TOTAL_ROW}:${endLetter}${TOTAL_ROW})` };
    cell.numFmt = "0.00";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_TOTAL } };
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "right" };
    cell.protection = { locked: true };
  }

  // Sheet protection — locked cells stay locked, yellow cells are unlocked.
  await ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    formatRows: true,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });

  // ── Riepilogo ordini sheet ──
  // Read-only itemized list — one row per (socio, prodotto). Same rows we
  // built the matrix from, sorted Socio → Prodotto for human reading.
  const riep = wb.addWorksheet("Riepilogo ordini");
  const riepHeaders = [
    "Socio",
    "Prodotto",
    "Varietà",
    "Formato",
    "Qta ordinata",
    "Prezzo unitario (€)",
    "Totale ordinato (€)",
  ];
  for (let i = 0; i < riepHeaders.length; i++) {
    const c = riep.getCell(1, i + 1);
    c.value = riepHeaders[i];
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_HEADER } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  }
  riep.getColumn(1).width = 22;
  riep.getColumn(2).width = 22;
  riep.getColumn(3).width = 14;
  riep.getColumn(4).width = 10;
  riep.getColumn(5).width = 12;
  riep.getColumn(6).width = 16;
  riep.getColumn(7).width = 18;
  const riepRows = [...rows].sort((a, b) => {
    const p = a.productName.localeCompare(b.productName);
    if (p !== 0) return p;
    return (a.variant ?? "").localeCompare(b.variant ?? "");
  });
  let riepR = 2;
  for (const row of riepRows) {
    riep.getCell(riepR, 1).value = row.memberName;
    riep.getCell(riepR, 2).value = row.productName;
    riep.getCell(riepR, 3).value = row.variant ?? "";
    riep.getCell(riepR, 4).value = row.format ?? "";
    riep.getCell(riepR, 5).value = row.quantity;
    riep.getCell(riepR, 6).value = parseFloat(row.unitPrice);
    riep.getCell(riepR, 6).numFmt = "0.00";
    riep.getCell(riepR, 7).value = parseFloat(row.lineTotal);
    riep.getCell(riepR, 7).numFmt = "0.00";
    riepR++;
  }
  riep.views = [{ state: "frozen", ySplit: 1 }];

  // ── Totali per prodotto sheet ──
  // Aggregated qty + amount per product, sorted by the same sortOrder/name
  // the matrix uses, so reading top-to-bottom matches what the supplier
  // sees in Distinta.
  const totp = wb.addWorksheet("Totali per prodotto");
  const totpHeaders = [
    "Prodotto",
    "Varietà",
    "Formato",
    "Qta totale ordinata",
    "Importo totale (€)",
  ];
  for (let i = 0; i < totpHeaders.length; i++) {
    const c = totp.getCell(1, i + 1);
    c.value = totpHeaders[i];
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_HEADER } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  }
  totp.getColumn(1).width = 22;
  totp.getColumn(2).width = 14;
  totp.getColumn(3).width = 10;
  totp.getColumn(4).width = 18;
  totp.getColumn(5).width = 16;
  let totpR = 2;
  for (const pid of productOrder) {
    const meta = productMeta.get(pid)!;
    let qtySum = 0;
    let amtSum = 0;
    for (const row of rows) {
      if (row.productId !== pid) continue;
      qtySum += row.quantity;
      amtSum += parseFloat(row.lineTotal);
    }
    totp.getCell(totpR, 1).value = meta.productName;
    totp.getCell(totpR, 2).value = meta.variant ?? "";
    totp.getCell(totpR, 3).value = meta.format ?? "";
    totp.getCell(totpR, 4).value = qtySum;
    totp.getCell(totpR, 5).value = amtSum;
    totp.getCell(totpR, 5).numFmt = "0.00";
    totpR++;
  }
  totp.views = [{ state: "frozen", ySplit: 1 }];

  // ── _meta sheet (hidden) ──
  const meta = wb.addWorksheet("_meta", { state: "hidden" });
  meta.getCell("A1").value = "formatVersion";
  meta.getCell("B1").value = DISTINTA_FORMAT_VERSION;
  meta.getCell("A2").value = "cycleId";
  meta.getCell("B2").value = cycle.cycleId;
  meta.getCell("A3").value = "cycleTitle";
  meta.getCell("B3").value = cycle.title;
  meta.getCell("A4").value = "supplierId";
  meta.getCell("B4").value = cycle.supplierId ?? "";
  meta.getCell("A5").value = "generatedAt";
  meta.getCell("B5").value = new Date().toISOString();
  meta.getCell("A6").value = "productRowStart";
  meta.getCell("B6").value = PRODUCT_ROW_START;
  meta.getCell("A7").value = "productRowEnd";
  meta.getCell("B7").value = PRODUCT_ROW_END;
  meta.getCell("A8").value = "shippingRow";
  meta.getCell("B8").value = SHIPPING_ROW;
  meta.getCell("A9").value = "memberColStart";
  meta.getCell("B9").value = memberColStart;
  meta.getCell("A10").value = "memberColEnd";
  meta.getCell("B10").value = memberColEnd;

  // Mapping table starts at row 12. Header on row 12, data row 13+.
  meta.getCell("A12").value = "kind";
  meta.getCell("B12").value = "sheetRow";
  meta.getCell("C12").value = "sheetCol";
  meta.getCell("D12").value = "id";
  meta.getCell("E12").value = "label";
  let mr = 13;
  for (let i = 0; i < productOrder.length; i++) {
    const pid = productOrder[i];
    meta.getCell(`A${mr}`).value = "product";
    meta.getCell(`B${mr}`).value = PRODUCT_ROW_START + i;
    meta.getCell(`C${mr}`).value = "";
    meta.getCell(`D${mr}`).value = pid;
    meta.getCell(`E${mr}`).value = productMeta.get(pid)!.productName;
    mr++;
  }
  for (let i = 0; i < memberOrder.length; i++) {
    const mid = memberOrder[i];
    meta.getCell(`A${mr}`).value = "member";
    meta.getCell(`B${mr}`).value = "";
    meta.getCell(`C${mr}`).value = memberColStart + i;
    meta.getCell(`D${mr}`).value = mid;
    meta.getCell(`E${mr}`).value = memberName.get(mid) ?? "";
    mr++;
  }

  const grandTotal = rows.reduce(
    (s, x) =>
      s + (x.actualLineTotal != null ? parseFloat(x.actualLineTotal) : parseFloat(x.lineTotal)),
    0,
  );

  const buf = await wb.xlsx.writeBuffer();
  return {
    filename: `distinta_${slug(cycle.title)}_${slug(cycle.supplierName ?? "")}.xlsx`,
    content: Buffer.from(buf),
    productCount: productOrder.length,
    memberCount: memberOrder.length,
    grandTotal,
  };
}
