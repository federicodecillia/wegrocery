// Heuristics that map free-form Italian column headers found in supplier
// listings to the fields we actually store. The wizard pre-fills the column
// mapping from this; the admin can still override every choice manually.

export type TargetField =
  | "name"
  | "variant"
  | "format"
  | "unitPrice"
  | "pricePerKg"
  | "category"
  | "emoji"
  | "notes";

export const TARGET_FIELDS: TargetField[] = [
  "name",
  "variant",
  "format",
  "unitPrice",
  "pricePerKg",
  "category",
  "emoji",
  "notes",
];

export const TARGET_LABEL: Record<TargetField, string> = {
  name: "Nome",
  variant: "Varietà",
  format: "Formato",
  unitPrice: "Prezzo",
  pricePerKg: "Prezzo/kg",
  category: "Categoria",
  emoji: "Icona",
  notes: "Note",
};

export const REQUIRED_FIELDS: TargetField[] = ["name", "unitPrice"];

// Each entry is a list of substrings (lowercased) tried against the header
// cell after normalisation. Ordered by priority — first hit wins, so put the
// more discriminative terms first.
const SYNONYMS: Record<TargetField, string[]> = {
  name: [
    "denominazione",
    "descrizione prodotto",
    "descrizione",
    "articolo",
    "prodotto",
    "nome",
  ],
  variant: ["varieta", "varietà", "var.", "tipologia", "tipo", "qualita", "qualità"],
  format: [
    "pezzatura",
    "confezione",
    "formato",
    "peso",
    "grammatura",
    "imballo",
  ],
  unitPrice: [
    "prezzo unitario",
    "prezzo iva",
    "prezzo €",
    "prezzo eur",
    "prezzo",
    "costo",
    "importo",
    "€",
    "eur",
  ],
  pricePerKg: ["prezzo/kg", "prezzo kg", "€/kg", "eur/kg", "al kg", "/kg"],
  category: ["categoria", "reparto", "famiglia", "gruppo"],
  emoji: ["icona", "emoji", "simbolo"],
  notes: ["note", "annotazion", "commento", "osservazion"],
};

function normalise(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    // strip combining marks except for `€` / `°`
    .replace(/[̀-ͯ]/g, "");
}

// Score a single header cell against the synonyms for a target field.
// Higher score = better match. Returns 0 when nothing matches.
function scoreHeader(header: string, field: TargetField): number {
  const h = normalise(header);
  if (!h) return 0;
  const syns = SYNONYMS[field];
  for (let i = 0; i < syns.length; i++) {
    const syn = normalise(syns[i]);
    if (h === syn) return 100 - i;
    if (h.includes(syn)) return 50 - i;
  }
  return 0;
}

// Given the header cells of a row, return the best column index for each
// target field. A column can only win one field — the highest scoring
// (field, column) pair claims it, then the next, and so on.
export function suggestMapping(columns: string[]): Partial<Record<TargetField, number>> {
  type Candidate = { field: TargetField; col: number; score: number };
  const candidates: Candidate[] = [];
  for (const field of TARGET_FIELDS) {
    for (let col = 0; col < columns.length; col++) {
      const score = scoreHeader(columns[col] ?? "", field);
      if (score > 0) candidates.push({ field, col, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const out: Partial<Record<TargetField, number>> = {};
  const usedCols = new Set<number>();
  for (const c of candidates) {
    if (out[c.field] !== undefined) continue;
    if (usedCols.has(c.col)) continue;
    out[c.field] = c.col;
    usedCols.add(c.col);
  }
  return out;
}

// A header row is "plausible" if it contains at least the name column and
// either a price column or a format column. We use this when sniffing the
// first few rows of a sheet to find where the real table starts.
export function isPlausibleHeaderRow(columns: string[]): boolean {
  const mapping = suggestMapping(columns);
  if (mapping.name === undefined) return false;
  return mapping.unitPrice !== undefined || mapping.format !== undefined;
}

// The field that already uses `col`, other than `except`.
export function fieldUsingColumn(
  mapping: Partial<Record<TargetField, number>>,
  col: number,
  except?: TargetField,
): TargetField | null {
  for (const field of TARGET_FIELDS) {
    if (field !== except && mapping[field] === col) return field;
  }
  return null;
}

// Assign `col` to `field` keeping one column per field: a field that held the
// column is set back to "ignore" and returned, so the wizard can say so.
// `col === undefined` clears the field.
export function assignColumn(
  mapping: Partial<Record<TargetField, number>>,
  field: TargetField,
  col: number | undefined,
): { mapping: Partial<Record<TargetField, number>>; freed: TargetField | null } {
  const next = { ...mapping };
  if (col === undefined) {
    delete next[field];
    return { mapping: next, freed: null };
  }
  const freed = fieldUsingColumn(next, col, field);
  if (freed) delete next[freed];
  next[field] = col;
  return { mapping: next, freed };
}

// True when two fields point at the same column (the server refuses it).
export function hasSharedColumn(mapping: Partial<Record<TargetField, number>>): boolean {
  const cols = Object.values(mapping).filter((c): c is number => c !== undefined);
  return new Set(cols).size !== cols.length;
}
