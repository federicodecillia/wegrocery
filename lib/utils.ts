import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { t } from "@/lib/i18n";
import {
  formatMoney,
  formatDate as formatDateIntl,
  formatDateTime as formatDateTimeIntl,
} from "@/lib/i18n/format";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Legacy helpers kept for their null-tolerant signatures and sign handling;
// they delegate to the brand-aware Intl formatters so every call site follows
// the deploy's locale and currency.
export function formatEur(amount: number): string {
  return formatMoney(Math.abs(amount));
}

export function formatEurSigned(amount: number): string {
  return (amount >= 0 ? "+" : "−") + formatEur(amount);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return formatDateIntl(new Date(date));
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "";
  return formatDateIntl(new Date(date), { day: "numeric", month: "short" });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  return formatDateTimeIntl(new Date(date));
}

export function getRoleLabel(role: string): string {
  if (role === "admin") return t.admin.common.roleAdmin;
  if (role === "attivo") return t.admin.common.roleMember;
  if (role === "socio") return t.admin.common.roleUser;
  return role;
}

export function canAccessCycle(accessLevel: string, role: string | null | undefined): boolean {
  if (role === "admin") return true;
  if (accessLevel === "all" || accessLevel === "utenti") return true;
  if (accessLevel === "admin") return false;
  if (accessLevel === "soci" || accessLevel === "attivi" || accessLevel === "member") {
    return role === "attivo" || role === "member" || role === "socio";
  }
  return false;
}

const EMOJI_MAP: [RegExp, string][] = [
  // ── Frutta ────────────────────────────────────────────────────────
  [/cocomero|anguria/i, "🍉"],
  [/melone/i, "🍈"],
  [/pesca|pesche/i, "🍑"],
  [/cilieg/i, "🍒"],
  [/melanz/i, "🍆"],        // MUST come before mela (substring match); covers melanzana/melanzane
  [/mela\b|mele\b/i, "🍎"],
  [/pera|pere\b/i, "🍐"],
  [/aranci|mandarin|clementin/i, "🍊"],
  [/limone|cedro/i, "🍋"],
  [/banana|banane/i, "🍌"],
  [/ananas/i, "🍍"],
  [/mango/i, "🥭"],
  [/cocco/i, "🥥"],
  [/uva/i, "🍇"],
  [/fragol/i, "🍓"],
  [/lampone|mirtillo|ribes|\bmore\b/i, "🫐"],
  [/kiwi/i, "🥝"],
  [/fico|fichi/i, "🍈"],
  [/susina|prugna|albicocc/i, "🍑"],
  [/castagn/i, "🌰"],
  [/melagran|melogran/i, "❤️"],
  [/oliv/i, "🫒"],
  // ── Verdura ───────────────────────────────────────────────────────
  [/tomat|pomodo/i, "🍅"],
  [/avocado/i, "🥑"],
  [/patat|topinambur/i, "🥔"],
  [/carota|carote/i, "🥕"],
  [/mais/i, "🌽"],
  [/peperonc/i, "🌶️"],    // peperoncino before peperone
  [/peperon(?!c)/i, "🫑"], // peperone/peperoni/peperonata; excludes peperoncino
  [/cetriol|zucchin/i, "🥒"], // stems cover cetriolo/cetrioli and zucchina/zucchine
  [/zucca|zucche/i, "🎃"],
  [/insalata|lattug|radicchio|spinac|sedano|finocchio|erbett|cicoria/i, "🥬"],
  [/broccol|cavolo|cavoli|verza|cavolfiore|cavolini/i, "🥦"],
  [/aglio/i, "🧄"],
  [/cipoll/i, "🧅"],        // cipolla, cipollotto, cipollone — MUST come before pollo
  [/porro|porrino/i, "🧅"],
  [/carciof/i, "🌿"],
  [/asparag/i, "🌿"],
  [/basilico|prezzemolo|\bmenta\b|rosmarino|salvia|timo|origano|aromatic/i, "🌿"],
  [/bietol|rapa|barbabietol/i, "🥦"],
  [/fagiol|fava|fave|lenticchi|pisello|piselli|cece|ceci/i, "🫘"],
  // ── Cereali, pane, pasta ──────────────────────────────────────────
  [/riso\b|risotto/i, "🍚"],   // MUST come before pane's bare "riso" substring match
  [/pane|focaccia|pizza|grano|farro|orzo|avena/i, "🍞"],
  [/pasta|spaghett|penne|rigatoni/i, "🍝"],
  // Raw ingredient last, so a dish name ("risotto ai funghi") keeps matching
  // the dish above instead of the mushroom underneath it.
  [/fungo|funghi|porcino|porcini|champignon/i, "🍄"],
  // ── Prodotti animali ──────────────────────────────────────────────
  [/uov/i, "🥚"],
  [/latte|yogurt|kefir/i, "🥛"],
  [/formagg|ricotta|mozzarella|pecorino|parmigian/i, "🧀"],
  [/burro|panna|crema/i, "🧈"],
  [/miele/i, "🍯"],
  [/poll|gallin|tacchin|anatr/i, "🍗"],
  [/carne|manzo|vitello|maiale|salume|salsicc/i, "🥩"],
  [/pancetta|bacon|guanciale|lardo/i, "🥓"],
  [/pesce|salmone|tonno|merluzzo|orata|branzino|alici|acciug|sgombro|sardin|baccal/i, "🐟"],
  [/gamber|scampi|cozze|vongole|crostace/i, "🦐"],
  [/calamar|totano|seppia|polpo|mollusc/i, "🦑"],
  // ── Condimenti ────────────────────────────────────────────────────
  [/olio/i, "🫙"],
  [/aceto/i, "🫙"],
  [/sale|pepe(?!rone|ronc)/i, "🧂"],
  // ── Bevande ───────────────────────────────────────────────────────
  [/vino/i, "🍷"],
  [/birra/i, "🍺"],
  [/succo|sprem/i, "🧃"],
];

export function getProductEmoji(name: string): string {
  return getProductEmojiOrNull(name) ?? "🛒";
}

// Same matching as getProductEmoji but returns null when no category pattern
// matched. The bulk-import wizard uses this to flag rows that need manual
// emoji confirmation, instead of silently shipping the 🛒 fallback.
export function getProductEmojiOrNull(name: string): string | null {
  for (const [pattern, emoji] of EMOJI_MAP) {
    if (pattern.test(name)) return emoji;
  }
  return null;
}

// Maps a product name to one of the preset categories used in CategorySelect
// (DEFAULT_CATEGORIES). Specific patterns come before general ones; returns
// null when nothing matches so the import wizard leaves the category blank
// rather than guessing wrong. Keep the category strings in sync with
// components/ui/category-select.tsx.
const CATEGORY_MAP: [RegExp, string][] = [
  // Pesce before Carne so "polpo/seppia" etc. don't fall into meat.
  [/pesce|salmone|tonno|merluzzo|orata|branzino|alici|acciug|sgombro|gamber|cozze|vongole|calamar|seppia|polpo|baccal/i, "Pesce"],
  // `\bpoll` (word boundary) so "cipollotto" falls through to Verdura instead
  // of matching "pollo" mid-word.
  [/\bpoll|gallina|tacchino|anatra|carne|manzo|vitello|maiale|salume|salsicc|prosciutto|speck|bresaola|salame|guanciale|pancetta|hamburger/i, "Carne"],
  [/uov[ao]/i, "Uova"],
  [/latte|yogurt|kefir|formagg|ricotta|mozzarella|pecorino|parmigian|stracchino|caciotta|burro|panna|mascarpone|gorgonzola/i, "Latticini"],
  [/pasta|spaghett|penne|rigatoni|fusilli|maccheron|tagliatell|gnocch|lasagn|riso\b|risotto/i, "Pasta e riso"],
  [/pane|focacc|pizza|grano|farro|orzo|avena|farina|cereal|crusca|cracker|grissin|fett[ae] biscott/i, "Pane e cereali"],
  [/olio|aceto/i, "Olio e aceto"],
  [/vino|birra|succo|spremitura|bibita|acqua\b|tisana|infuso/i, "Bevande"],
  [/miele|marmellat|confettur|biscott|torta|dolce|cioccolat|cacao|nutella|crostata|merendin|zucchero/i, "Dolci"],
  [/passat|pomodor[oi] pelat|conserv|sottolio|sottaceto|pesto|sugo|ragù|ragu\b|legumi in barattolo/i, "Conserve"],
  // Frutta — mirror the emoji-map fruit area.
  [/mela\b|mele\b|pera|pere\b|aranc|limone|cedro|banana|banane|ananas|mango|uva\b|fragol|lampone|mirtillo|ribes|kiwi|fico|fichi|susina|prugna|pesca|pesche|cilieg|castagn|melagran|melogran|cocomero|anguria|melone|albicocc|mandarin|clementin|lime\b|frutt/i, "Frutta"],
  // Verdura — mirror the emoji-map vegetable area.
  [/pomodor|melanz|patat|carota|carote|mais|peperon|cetriol|zucchin|zucca|zucche|insalata|lattug|radicchio|spinac|sedano|finocchio|erbett|cicoria|broccol|cavolo|cavoli|verza|cavolfiore|aglio|cipoll|porro|porrino|fungo|funghi|porcino|champignon|carciof|asparag|biet[ao]|bietol|rapa|barbabietol|fagiol|fava|fave\b|lenticchi|pisello|piselli|cece|ceci\b|topinambur|ravanell|rucola|verdur|ortagg/i, "Verdura"],
];

export function guessProductCategory(name: string): string | null {
  if (!name) return null;
  for (const [pattern, category] of CATEGORY_MAP) {
    if (pattern.test(name)) return category;
  }
  return null;
}

// Category names are free text typed by different admins over time, so
// "Verdura" and "verdura" drift into separate groups. Compare through this
// normalization everywhere; keep the stored value (first-seen casing) for
// display.
export function normalizeCategory(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

// Returns the already-known spelling of `value` when one exists (ignoring
// case/whitespace), so new entries merge into an existing category instead
// of creating a duplicate that differs only in casing.
export function canonicalizeCategory(value: string, known: ReadonlyArray<string>): string {
  const norm = normalizeCategory(value);
  if (!norm) return value.trim();
  return known.find((k) => normalizeCategory(k) === norm) ?? value.trim();
}

// Labels a supplier file uses as a catch-all for "nothing more specific"
// (many fornitori literally write "Altro" against every row they didn't
// bother sub-categorizing). Trusting that verbatim would ship an otherwise
// guessable product ("Zucchina" → Verdura) straight into "Altro" — treat
// these the same as a blank category column so the guess gets a chance.
const GENERIC_CATEGORY_LABELS = new Set([
  "altro",
  "altri",
  "altre",
  "vario",
  "vari",
  "varie",
  "misto",
  "mista",
  "misti",
  "miste",
  "generico",
  "generica",
]);

export function isGenericCategoryLabel(value: string | null | undefined): boolean {
  return GENERIC_CATEGORY_LABELS.has(normalizeCategory(value));
}
