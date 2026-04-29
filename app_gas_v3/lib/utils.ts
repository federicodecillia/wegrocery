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
  [/melanz|cocomero|anguria/i, "🍉"],
  [/melone/i, "🍈"],
  [/pesca|pesche/i, "🍑"],
  [/cilieg/i, "🍒"],
  [/mela/i, "🍎"],
  [/pera/i, "🍐"],
  [/aranci/i, "🍊"],
  [/limone/i, "🍋"],
  [/banana/i, "🍌"],
  [/ananas/i, "🍍"],
  [/mango/i, "🥭"],
  [/uva/i, "🍇"],
  [/fragol/i, "🍓"],
  [/lampone|mirtillo/i, "🫐"],
  [/kiwi/i, "🥝"],
  [/tomat|pomodo/i, "🍅"],
  [/avocado/i, "🥑"],
  [/melanzana/i, "🍆"],
  [/patata/i, "🥔"],
  [/carota/i, "🥕"],
  [/mais/i, "🌽"],
  [/peperone/i, "🫑"],
  [/cetriolo|zucchina/i, "🥒"],
  [/insalata|lattug|radicchio|spinac|sedano|finocchio/i, "🥬"],
  [/broccolo|cavolo|rapa/i, "🥦"],
  [/aglio/i, "🧄"],
  [/cipolla/i, "🧅"],
  [/fungo/i, "🍄"],
  [/nocciola|noce|mandorla|arachide/i, "🥜"],
  [/pane|focaccia/i, "🍞"],
  [/uov/i, "🥚"],
  [/latte/i, "🥛"],
  [/formaggio/i, "🧀"],
  [/miele/i, "🍯"],
  [/olio/i, "🫙"],
  [/pollo|gallina/i, "🍗"],
  [/carne|manzo|vitello/i, "🥩"],
  [/pesce|salmone|tonno/i, "🐟"],
];

export function getProductEmoji(name: string): string {
  for (const [pattern, emoji] of EMOJI_MAP) {
    if (pattern.test(name)) return emoji;
  }
  return "🛒";
}
