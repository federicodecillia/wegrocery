// Minimal OpenDocument Spreadsheet (.ods) reader.
//
// We only need random cell access by (sheet name, 1-based row, 1-based col),
// matching the shape exceljs gives us, so the distinta parser can treat an
// .ods re-save of our own .xlsx exactly like the original — the hidden
// `_meta` sheet survives a LibreOffice "Save as .ods", so the round-trip
// mapping stays intact. We deliberately do NOT pull in a full spreadsheet
// library: an .ods is a zip of XML, and reading cell values out of
// `content.xml` is a small, well-bounded job.
//
// Two subtleties drive the design:
//
//  1. `table:number-columns-repeated` / `number-rows-repeated`: ODS collapses
//     runs of identical (usually empty) cells/rows into a single element with
//     a repeat count, and trailing empty runs can claim hundreds of thousands
//     of columns/rows. We advance the coordinate counter by the repeat count
//     but only *store* non-empty cells, so there is no memory blow-up.
//
//  2. Merged cells (our distinta merges the label columns on the shipping and
//     total rows) emit one `table:table-cell` followed by
//     `table:covered-table-cell` placeholders. Those placeholders still occupy
//     columns, so the member value columns after them would shift if we
//     ignored them. We therefore parse in document order (`preserveOrder`) and
//     advance the column cursor for covered cells too.
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

const VALUE_TYPES_NUMERIC = new Set(["float", "currency", "percentage"]);

// Guard against a pathological repeat count (ODS files routinely end a row
// with number-columns-repeated="1016" and sheets with a giant trailing empty
// row run). We never need to walk past the real data, so cap how far a single
// repeat can push the cursor.
const MAX_REPEAT = 16384;

// In preserveOrder mode every node is `{ "<tag>": [...children] , ":@": {attrs} }`
// or a text node `{ "#text": value }`.
type Node = Record<string, unknown> & { ":@"?: Record<string, unknown> };

function tagOf(node: Node): string | undefined {
  for (const k of Object.keys(node)) if (k !== ":@") return k;
  return undefined;
}
function childrenOf(node: Node): Node[] {
  const tag = tagOf(node);
  const v = tag ? node[tag] : undefined;
  return Array.isArray(v) ? (v as Node[]) : [];
}
function attr(node: Node, name: string): string | undefined {
  const v = node[":@"]?.[`@_${name}`];
  return v == null ? undefined : String(v);
}
function findChildren(nodes: Node[], tag: string): Node[] {
  return nodes.filter((n) => tagOf(n) === tag);
}
function findChild(nodes: Node[], tag: string): Node | undefined {
  return nodes.find((n) => tagOf(n) === tag);
}

function repeat(value: string | undefined): number {
  const n = value ? parseInt(value, 10) : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_REPEAT);
}

// Pulls the displayed text out of a cell's <text:p> descendants (used for
// string-typed cells like the _meta ids). Numbers come from @_office:value
// instead and never reach here.
function collectText(nodes: Node[]): string {
  let out = "";
  for (const n of nodes) {
    if ("#text" in n) out += String(n["#text"]);
    else out += collectText(childrenOf(n));
  }
  return out;
}

function cellValue(cell: Node): string | number | null {
  const type = attr(cell, "office:value-type");
  if (type && VALUE_TYPES_NUMERIC.has(type)) {
    const raw = attr(cell, "office:value");
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  }
  const text = collectText(childrenOf(cell)).trim();
  return text === "" ? null : text;
}

/** A single sheet, addressable by 1-based (row, col) like exceljs. */
export class OdsSheet {
  private cells = new Map<string, string | number>();

  set(row: number, col: number, value: string | number | null): void {
    if (value === null || value === "") return;
    this.cells.set(`${row}:${col}`, value);
  }

  cell(row: number, col: number): string | number | null {
    return this.cells.get(`${row}:${col}`) ?? null;
  }
}

export class OdsWorkbook {
  constructor(private sheets: Map<string, OdsSheet>) {}

  sheet(name: string): OdsSheet | undefined {
    return this.sheets.get(name);
  }
}

// Decompression-bomb guard: a tiny crafted .ods can declare a huge
// content.xml. Any legit distinta re-save is well under this; entries over
// the cap are skipped, which surfaces as "content.xml not found" below.
const MAX_UNZIPPED_ENTRY_BYTES = 64 * 1024 * 1024;

export function parseOds(buffer: Buffer): OdsWorkbook {
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (f) => f.originalSize <= MAX_UNZIPPED_ENTRY_BYTES,
  });
  const contentU8 = files["content.xml"];
  if (!contentU8) {
    throw new Error("content.xml not found — not a valid .ods file");
  }
  const xml = strFromU8(contentU8);

  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: false,
  });
  const tree = parser.parse(xml) as Node[];

  const docContent = findChild(tree, "office:document-content");
  const body = docContent && findChild(childrenOf(docContent), "office:body");
  const spreadsheet = body && findChild(childrenOf(body), "office:spreadsheet");
  const tables = spreadsheet ? findChildren(childrenOf(spreadsheet), "table:table") : [];

  const sheets = new Map<string, OdsSheet>();
  for (const table of tables) {
    const name = attr(table, "table:name");
    if (!name) continue;
    const sheet = new OdsSheet();
    let rowIdx = 1;
    for (const row of findChildren(childrenOf(table), "table:table-row")) {
      const rowRepeat = repeat(attr(row, "table:number-rows-repeated"));
      // Walk cells in document order so merged-cell "covered" placeholders
      // keep the column cursor aligned with the value-bearing cells after them.
      const rowCells: Array<{ col: number; value: string | number | null }> = [];
      let colIdx = 1;
      for (const cell of childrenOf(row)) {
        const tag = tagOf(cell);
        if (tag !== "table:table-cell" && tag !== "table:covered-table-cell") continue;
        const colRepeat = repeat(attr(cell, "table:number-columns-repeated"));
        const value = tag === "table:table-cell" ? cellValue(cell) : null;
        if (value !== null) {
          for (let k = 0; k < colRepeat; k++) rowCells.push({ col: colIdx + k, value });
        }
        colIdx += colRepeat;
      }
      for (let rr = 0; rr < rowRepeat; rr++) {
        for (const { col, value } of rowCells) sheet.set(rowIdx + rr, col, value);
      }
      rowIdx += rowRepeat;
    }
    sheets.set(name, sheet);
  }

  return new OdsWorkbook(sheets);
}
