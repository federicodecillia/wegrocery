import ExcelJS from "exceljs";

const FILL_HEADER = "FF2D2B29";
const FILL_EXAMPLE = "FFFAF8F5";

const HEADERS = [
  "Nome",
  "Varietà",
  "Formato",
  "Prezzo",
  "Prezzo/kg",
  "Categoria",
  "Icona",
  "Note",
] as const;

// One example per common GAS category so admins can copy-paste and adapt
// instead of starting from a blank sheet.
const EXAMPLES: Array<{
  name: string;
  variant: string;
  format: string;
  price: number;
  pricePerKg: number | "";
  category: string;
  emoji: string;
  notes: string;
}> = [
  { name: "Mela", variant: "Stark Bio", format: "1 kg", price: 2.5, pricePerKg: 2.5, category: "Frutta", emoji: "🍎", notes: "Raccolta locale" },
  { name: "Insalata mista", variant: "Bio", format: "Cestino 200g", price: 3.0, pricePerKg: 15.0, category: "Verdura", emoji: "🥬", notes: "Raccolta del mattino" },
  { name: "Pane casereccio", variant: "", format: "Pagnotta 1kg", price: 4.5, pricePerKg: 4.5, category: "Pane e cereali", emoji: "🍞", notes: "Lievito madre" },
  { name: "Pasta integrale", variant: "", format: "Pacco 500g", price: 1.8, pricePerKg: "", category: "Pasta e riso", emoji: "🍝", notes: "" },
  { name: "Mozzarella", variant: "Fior di latte", format: "Confezione 250g", price: 4.2, pricePerKg: "", category: "Latticini", emoji: "🧀", notes: "Da consumare entro 3 giorni" },
  { name: "Uova", variant: "Galline ruspanti", format: "Confezione 6 pz", price: 3.0, pricePerKg: "", category: "Uova", emoji: "🥚", notes: "Allevamento all'aperto" },
  { name: "Pollo intero", variant: "", format: "Circa 1,5 kg", price: 12.0, pricePerKg: 8.0, category: "Carne", emoji: "🍗", notes: "Pesato singolarmente" },
  { name: "Passata di pomodoro", variant: "Bio", format: "Bottiglia 700g", price: 3.5, pricePerKg: "", category: "Conserve", emoji: "🍅", notes: "Pomodoro 100% italiano" },
  { name: "Olio extravergine", variant: "Coratina", format: "Bottiglia 750ml", price: 14.0, pricePerKg: "", category: "Olio e aceto", emoji: "🫒", notes: "Spremitura a freddo" },
];

export async function buildProductTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Porta Moneta GAS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Prodotti");

  ws.columns = [
    { width: 22 },
    { width: 16 },
    { width: 18 },
    { width: 10 },
    { width: 11 },
    { width: 16 },
    { width: 8 },
    { width: 28 },
  ];

  // Header row
  for (let i = 0; i < HEADERS.length; i++) {
    const c = ws.getCell(1, i + 1);
    c.value = HEADERS[i];
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_HEADER } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  }

  // Example rows
  for (let i = 0; i < EXAMPLES.length; i++) {
    const r = i + 2;
    const ex = EXAMPLES[i];
    ws.getCell(r, 1).value = ex.name;
    ws.getCell(r, 2).value = ex.variant;
    ws.getCell(r, 3).value = ex.format;
    const priceCell = ws.getCell(r, 4);
    priceCell.value = ex.price;
    priceCell.numFmt = "0.00";
    const ppkCell = ws.getCell(r, 5);
    if (ex.pricePerKg !== "") {
      ppkCell.value = ex.pricePerKg;
      ppkCell.numFmt = "0.00";
    }
    ws.getCell(r, 6).value = ex.category;
    ws.getCell(r, 7).value = ex.emoji;
    ws.getCell(r, 7).alignment = { horizontal: "center" };
    ws.getCell(r, 8).value = ex.notes;

    for (let col = 1; col <= 8; col++) {
      const cell = ws.getCell(r, col);
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF666666" }, italic: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_EXAMPLE } };
    }
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

type ParsedRow = {
  name: string;
  variant: string | null;
  format: string | null;
  unitPrice: string;
  pricePerKg: string | null;
  category: string | null;
  emoji: string | null;
  notes: string | null;
};

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "text" in v) {
    const t = (v as { text: unknown }).text;
    return typeof t === "string" ? t.trim() : "";
  }
  if (typeof v === "object" && "result" in v) {
    return cellText((v as { result: unknown }).result);
  }
  return String(v).trim();
}

function cellNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = cellText(v).replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export async function parseProductTemplate(buf: Buffer): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  await wb.xlsx.load(ab);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const rows: ParsedRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const name = cellText(row.getCell(1).value);
    if (!name) return;
    const price = cellNumber(row.getCell(4).value);
    if (price == null) return;
    const ppk = cellNumber(row.getCell(5).value);
    rows.push({
      name,
      variant: cellText(row.getCell(2).value) || null,
      format: cellText(row.getCell(3).value) || null,
      unitPrice: price.toFixed(2),
      pricePerKg: ppk != null ? ppk.toFixed(2) : null,
      category: cellText(row.getCell(6).value) || null,
      emoji: cellText(row.getCell(7).value) || null,
      notes: cellText(row.getCell(8).value) || null,
    });
  });
  return rows;
}
