import ExcelJS from "exceljs";
import { isPlausibleHeaderRow } from "./header-heuristics";

export type ParsedSheet = {
  sheetName: string;
  headerRowIndex: number; // 1-based row number in the sheet
  columns: string[];      // header cells, normalised to strings (may contain "")
  rows: string[][];       // all data rows below the header (also strings)
};

export type SupplierHint = {
  // candidate supplier name extracted either from the filename or from a
  // cell looking like "Fornitore: Rossi". The wizard tries to fuzzy-match
  // this against the existing suppliers list.
  text: string;
  source: "filename" | "cell";
};

export type ListingInspection = {
  sheets: ParsedSheet[];
  supplierHints: SupplierHint[];
};

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text.trim();
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((r) => (typeof r === "object" && r && "text" in r ? String((r as { text: unknown }).text ?? "") : ""))
        .join("")
        .trim();
    }
    if ("result" in obj) return cellToString(obj.result);
    if ("hyperlink" in obj && "text" in obj) return cellToString(obj.text);
  }
  return String(v).trim();
}

function rowToStrings(row: ExcelJS.Row, width: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= width; i++) {
    out.push(cellToString(row.getCell(i).value));
  }
  return out;
}

// Strip trailing empty columns so the preview table doesn't show 200 blank
// cells just because Excel kept formatting somewhere on the right.
function trimRight(cells: string[]): string[] {
  let end = cells.length;
  while (end > 0 && cells[end - 1] === "") end--;
  return cells.slice(0, end);
}

// Find the first row in the sheet that "looks like" a header — meaning it
// contains at least a recognisable name column plus a price or format.
// Falls back to row 1 if nothing matches in the first MAX_LOOKBACK rows.
const MAX_LOOKBACK = 10;

function detectHeaderRow(ws: ExcelJS.Worksheet): { rowIndex: number; columns: string[] } {
  const width = ws.actualColumnCount || ws.columnCount || 16;
  const upper = Math.min(MAX_LOOKBACK, ws.actualRowCount || ws.rowCount || MAX_LOOKBACK);
  for (let i = 1; i <= upper; i++) {
    const row = ws.getRow(i);
    const cells = trimRight(rowToStrings(row, width));
    if (cells.length === 0) continue;
    if (isPlausibleHeaderRow(cells)) {
      return { rowIndex: i, columns: cells };
    }
  }
  const fallback = ws.getRow(1);
  return { rowIndex: 1, columns: trimRight(rowToStrings(fallback, width)) };
}

function extractSupplierHintFromCells(ws: ExcelJS.Worksheet, upTo: number): SupplierHint | null {
  const width = ws.actualColumnCount || ws.columnCount || 16;
  for (let i = 1; i <= upTo; i++) {
    const row = ws.getRow(i);
    for (let c = 1; c <= width; c++) {
      const text = cellToString(row.getCell(c).value);
      if (!text) continue;
      const m = text.match(/^\s*fornitor[ei]\s*[:\-–]\s*(.+)$/i);
      if (m && m[1].trim()) return { text: m[1].trim(), source: "cell" };
    }
  }
  return null;
}

function extractSupplierHintFromFilename(filename: string): SupplierHint | null {
  // listino_rossi_2026-05.xlsx → "rossi"
  // fornitore-mario.bianchi.xlsx → "mario bianchi"
  const base = filename
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .replace(/[._\-]+/g, " ")
    .replace(/\b(listino|catalogo|prodotti|prezzi|fornitore|gas|porta|moneta|template)\b/gi, " ")
    .replace(/\b\d{1,4}\b/g, " ") // drop bare numbers (years, weeks)
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return null;
  return { text: base, source: "filename" };
}

async function inspectXlsx(buf: Buffer, filename: string): Promise<ListingInspection> {
  const wb = new ExcelJS.Workbook();
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  await wb.xlsx.load(ab);

  const sheets: ParsedSheet[] = [];
  const supplierHints: SupplierHint[] = [];

  const filenameHint = extractSupplierHintFromFilename(filename);
  if (filenameHint) supplierHints.push(filenameHint);

  for (const ws of wb.worksheets) {
    if (ws.name === "_meta") continue; // ignore distinta-builder meta sheet
    const { rowIndex: headerRowIndex, columns } = detectHeaderRow(ws);
    const cellHint = extractSupplierHintFromCells(ws, headerRowIndex - 1);
    if (cellHint) supplierHints.push(cellHint);

    const width = columns.length || ws.actualColumnCount || ws.columnCount || 1;
    const rows: string[][] = [];
    const lastRow = ws.actualRowCount || ws.rowCount || headerRowIndex;
    for (let i = headerRowIndex + 1; i <= lastRow; i++) {
      const r = ws.getRow(i);
      const cells = rowToStrings(r, width);
      if (cells.every((c) => c === "")) continue;
      rows.push(cells);
    }
    sheets.push({ sheetName: ws.name, headerRowIndex, columns, rows });
  }

  return { sheets, supplierHints };
}

// CSV: very lightweight — supports `;` and `,` delimiters, double-quote escaping.
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function inspectCsv(text: string, filename: string): ListingInspection {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return { sheets: [], supplierHints: [] };

  // pick delimiter from the first non-empty line — whichever produces more cols
  const semi = splitCsvLine(lines[0], ";").length;
  const comma = splitCsvLine(lines[0], ",").length;
  const delim = semi >= comma ? ";" : ",";

  const matrix = lines.map((l) => splitCsvLine(l, delim));

  // pad to same width
  const width = Math.max(...matrix.map((r) => r.length));
  for (const r of matrix) while (r.length < width) r.push("");

  // detect header row inside the first MAX_LOOKBACK
  let headerRowIndex = 1;
  for (let i = 0; i < Math.min(matrix.length, MAX_LOOKBACK); i++) {
    if (isPlausibleHeaderRow(matrix[i])) {
      headerRowIndex = i + 1;
      break;
    }
  }
  const columns = trimRight(matrix[headerRowIndex - 1]);
  const rows = matrix.slice(headerRowIndex).filter((r) => r.some((c) => c !== ""));

  const supplierHints: SupplierHint[] = [];
  const fn = extractSupplierHintFromFilename(filename);
  if (fn) supplierHints.push(fn);
  for (let i = 0; i < headerRowIndex - 1; i++) {
    for (const cell of matrix[i]) {
      const m = cell.match(/^\s*fornitor[ei]\s*[:\-–]\s*(.+)$/i);
      if (m && m[1].trim()) supplierHints.push({ text: m[1].trim(), source: "cell" });
    }
  }

  return {
    sheets: [{ sheetName: "CSV", headerRowIndex, columns, rows }],
    supplierHints,
  };
}

export async function inspectListing(buf: Buffer, filename: string): Promise<ListingInspection> {
  if (/\.csv$/i.test(filename)) {
    return inspectCsv(buf.toString("utf8"), filename);
  }
  return inspectXlsx(buf, filename);
}

// Suggest a supplier from the existing list by fuzzy-matching against the
// extracted hints. Token overlap is enough for typical "Rossi" / "Mario
// Bianchi" cases without dragging in a Levenshtein dependency.
export function pickSupplierMatch<T extends { name: string }>(
  hints: SupplierHint[],
  suppliers: T[],
): T | null {
  if (!suppliers.length || !hints.length) return null;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);

  let best: { supplier: T; score: number } | null = null;
  for (const hint of hints) {
    const hintTokens = new Set(norm(hint.text));
    if (!hintTokens.size) continue;
    for (const sup of suppliers) {
      const supTokens = new Set(norm(sup.name));
      let hits = 0;
      for (const t of supTokens) if (hintTokens.has(t)) hits++;
      if (!hits) continue;
      const score = hits + (hint.source === "cell" ? 0.5 : 0);
      if (!best || score > best.score) best = { supplier: sup, score };
    }
  }
  return best ? best.supplier : null;
}
