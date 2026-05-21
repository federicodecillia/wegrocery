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

// Reads a number out of an ExcelJS cell. Accepts native numbers, formula
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

export async function parseSupplierDistinta(
  fileBuffer: Buffer,
  expectedCycleId: string,
): Promise<DistintaImportPreview> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let wb: ExcelJS.Workbook;
  try {
    wb = new ExcelJS.Workbook();
    // The exceljs typings predate @types/node's generic Buffer<ArrayBufferLike>;
    // the value is bit-for-bit fine, only the structural type check trips.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(fileBuffer as any);
  } catch (e) {
    return {
      cycleId: expectedCycleId,
      cycleTitle: "",
      corrections: [],
      shippingChanges: [],
      warnings: [],
      errors: [`Impossibile aprire il file: ${e instanceof Error ? e.message : "errore sconosciuto"}. Assicurati che sia un .xlsx valido.`],
    };
  }

  const meta = wb.getWorksheet("_meta");
  const ws = wb.getWorksheet("Distinta");
  if (!meta || !ws) {
    return {
      cycleId: expectedCycleId,
      cycleTitle: "",
      corrections: [],
      shippingChanges: [],
      warnings: [],
      errors: [
        !meta
          ? "Foglio _meta mancante: il file non sembra una distinta generata dall'app. Riscarica la distinta dal ciclo."
          : "Foglio Distinta mancante: verifica di aver caricato il file giusto.",
      ],
    };
  }

  // Header values are anchored by their A-column label.
  const get = (a: string, b: string): unknown => {
    if (meta.getCell(a).value !== undefined) return meta.getCell(b).value;
    return undefined;
  };
  const formatVersion = readNumber(get("A1", "B1"));
  const cycleId = String(meta.getCell("B2").value ?? "");
  const cycleTitle = String(meta.getCell("B3").value ?? "");
  const productRowStart = readNumber(meta.getCell("B6").value);
  const productRowEnd = readNumber(meta.getCell("B7").value);
  const shippingRow = readNumber(meta.getCell("B8").value);
  const memberColStart = readNumber(meta.getCell("B9").value);
  const memberColEnd = readNumber(meta.getCell("B10").value);

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
    errors.push("Coordinate della matrice mancanti nel foglio _meta.");
  }
  if (errors.length > 0) {
    return { cycleId: expectedCycleId, cycleTitle, corrections: [], shippingChanges: [], warnings, errors };
  }

  // Read mapping table (row 13+ in _meta).
  const productByRow = new Map<number, string>();
  const memberByCol = new Map<number, string>();
  let mr = 13;
  while (true) {
    const kind = meta.getCell(`A${mr}`).value;
    if (kind == null || kind === "") break;
    const sheetRow = readNumber(meta.getCell(`B${mr}`).value);
    const sheetCol = readNumber(meta.getCell(`C${mr}`).value);
    const id = String(meta.getCell(`D${mr}`).value ?? "");
    if (kind === "product" && sheetRow != null && id) {
      productByRow.set(sheetRow, id);
    } else if (kind === "member" && sheetCol != null && id) {
      memberByCol.set(sheetCol, id);
    }
    mr++;
    if (mr > 5000) break; // sanity guard
  }

  if (productByRow.size === 0 || memberByCol.size === 0) {
    errors.push("Mappatura prodotti/soci vuota nel foglio _meta.");
    return { cycleId, cycleTitle, corrections: [], shippingChanges: [], warnings, errors };
  }

  // ── DB lookup: current state of orders and shipping for this cycle ──
  const db = getDb();

  const [cycle] = await db
    .select({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      status: orderCycles.status,
    })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!cycle) {
    errors.push("Ciclo non più presente nel database.");
    return { cycleId, cycleTitle, corrections: [], shippingChanges: [], warnings, errors };
  }
  if (cycle.status !== "closed") {
    errors.push("Il ciclo non è chiuso: la distinta si può applicare solo a cicli chiusi.");
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

  // ── Walk the matrix ──
  const corrections: DistintaCorrection[] = [];
  for (const [rowIdx, productId] of productByRow.entries()) {
    const productName = productNameById.get(productId) ?? productId;
    for (const [colIdx, memberId] of memberByCol.entries()) {
      const cell = ws.getCell(rowIdx, colIdx);
      const newTotal = readNumber(cell.value);
      const existing = linesByKey.get(`${productId}::${memberId}`);
      const memberName = memberNameById.get(memberId) ?? memberId;

      if (!existing) {
        // No original order for this (product, member). If the supplier
        // typed a non-zero value here, surface a warning and skip.
        if (newTotal != null && Math.abs(newTotal) >= EPS) {
          warnings.push(
            `${memberName} · ${productName}: ${newTotal.toFixed(2).replace(".", ",")} € inserito ma non c'era un ordine — ignorato.`,
          );
        }
        continue;
      }

      if (newTotal == null) {
        warnings.push(
          `${memberName} · ${productName}: valore non leggibile come numero — ignorato.`,
        );
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
  }

  // ── Shipping row ──
  const shippingChanges: DistintaShippingChange[] = [];
  for (const [colIdx, memberId] of memberByCol.entries()) {
    const cell = ws.getCell(shippingRow!, colIdx);
    const newShipping = readNumber(cell.value);
    if (newShipping == null) continue;
    const oldShipping = shippingByMember.get(memberId) ?? 0;
    if (Math.abs(newShipping - oldShipping) < EPS) continue;
    const memberName = memberNameById.get(memberId) ?? memberId;
    shippingChanges.push({ memberId, memberName, oldShipping, newShipping });
  }

  return {
    cycleId,
    cycleTitle: cycle.title,
    corrections,
    shippingChanges,
    warnings,
    errors,
  };
}
