import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEur(amount: number): string {
  return "€" + Math.abs(amount).toFixed(2).replace(".", ",");
}

export function formatEurSigned(amount: number): string {
  return (amount >= 0 ? "+" : "−") + formatEur(amount);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getRoleLabel(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "attivo") return "Socio";
  if (role === "socio") return "Utente";
  return role;
}

const EMOJI_MAP: [RegExp, string][] = [
  // ── Frutta ────────────────────────────────────────────────────────
  [/melanz|cocomero|anguria/i, "🍉"],
  [/melone/i, "🍈"],
  [/pesca|pesche/i, "🍑"],
  [/cilieg/i, "🍒"],
  [/mela/i, "🍎"],          // MUST come after melanzana/melone
  [/pera/i, "🍐"],
  [/aranci/i, "🍊"],
  [/limone|cedro/i, "🍋"],
  [/banana/i, "🍌"],
  [/ananas/i, "🍍"],
  [/mango/i, "🥭"],
  [/uva/i, "🍇"],
  [/fragol/i, "🍓"],
  [/lampone|mirtillo|ribes/i, "🫐"],
  [/kiwi/i, "🥝"],
  [/fico|fichi/i, "🍈"],
  [/susina|prugna/i, "🍑"],
  [/castagna/i, "🌰"],
  [/melagran|melogran/i, "❤️"],
  // ── Verdura ───────────────────────────────────────────────────────
  [/tomat|pomodo/i, "🍅"],
  [/avocado/i, "🥑"],
  [/melanzana/i, "🍆"],
  [/patata/i, "🥔"],
  [/carota/i, "🥕"],
  [/mais/i, "🌽"],
  [/peperonc/i, "🌶️"],    // peperoncino before peperone
  [/peperone/i, "🫑"],
  [/cetriolo|zucchina/i, "🥒"],
  [/zucca/i, "🎃"],
  [/insalata|lattug|radicchio|spinac|sedano|finocchio|erbett|cicoria/i, "🥬"],
  [/broccolo|cavolo|verza|cavolfiore|cavolini/i, "🥦"],
  [/aglio/i, "🧄"],
  [/cipoll/i, "🧅"],        // cipolla, cipollotto, cipollone — MUST come before pollo
  [/porro|porrino/i, "🧅"],
  [/fungo|porcino|champignon/i, "🍄"],
  [/carciofo/i, "🌿"],
  [/asparago/i, "🌿"],
  [/bietol|rapa|barbabietol/i, "🥦"],
  [/fagiolo|fagiolino|fava|lenticchia|pisello|cece/i, "🫘"],
  [/patatina|topinambur/i, "🥔"],
  // ── Cereali, pane, legumi ─────────────────────────────────────────
  [/pane|focaccia|pizza|grano|farro|orzo|avena|riso/i, "🍞"],
  [/pasta|spaghett|penne|rigatoni/i, "🍝"],
  // ── Prodotti animali ──────────────────────────────────────────────
  [/uov/i, "🥚"],
  [/latte|yogurt|kefir/i, "🥛"],
  [/formaggio|ricotta|mozzarella|pecorino|parmigiano/i, "🧀"],
  [/burro|panna|crema/i, "🧈"],
  [/miele/i, "🍯"],
  [/pollo|gallina|tacchino|anatra/i, "🍗"],
  [/carne|manzo|vitello|maiale|salume|salsicc|salsiccia/i, "🥩"],
  [/pesce|salmone|tonno|merluzzo|orata|branzino/i, "🐟"],
  // ── Condimenti ────────────────────────────────────────────────────
  [/olio/i, "🫙"],
  [/aceto/i, "🫙"],
  [/sale|pepe(?!rone|ronc)/i, "🧂"],
  // ── Bevande ───────────────────────────────────────────────────────
  [/vino/i, "🍷"],
  [/birra/i, "🍺"],
  [/succo|spremitura/i, "🧃"],
];

export function getProductEmoji(name: string): string {
  for (const [pattern, emoji] of EMOJI_MAP) {
    if (pattern.test(name)) return emoji;
  }
  return "🛒";
}
