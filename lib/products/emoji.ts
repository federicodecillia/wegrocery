import { getProductEmojiOrNull } from "@/lib/utils";

// The cart is the fallback the app shows when nothing better is known, and
// older imports stored it too: it never counts as an admin's choice.
export const FALLBACK_PRODUCT_EMOJI = "🛒";

/** The key products share an icon by: the name, trimmed and lower case. */
export function productEmojiKey(name: string): string {
  return name.trim().toLowerCase();
}

/** True for an icon someone chose (or a name matched), not empty and not the cart. */
export function isChosenEmoji(emoji: string | null | undefined): emoji is string {
  const e = emoji?.trim();
  return Boolean(e) && e !== FALLBACK_PRODUCT_EMOJI;
}

export type ResolvedEmoji = {
  emoji: string;
  source: "override" | "saved" | "name" | "fallback";
};

// The icon an imported row gets: the one the admin picked in the preview,
// else the one the group already uses for a product with that name, else one
// matched on the name, else the cart. The import used to skip the saved icon,
// so every new listing put the name-matched (or cart) icon back.
export function resolveProductEmoji(
  name: string,
  override: string | null | undefined,
  saved: string | null | undefined,
): ResolvedEmoji {
  const picked = override?.trim();
  if (picked) return { emoji: picked, source: "override" };
  if (isChosenEmoji(saved)) return { emoji: saved.trim(), source: "saved" };
  const auto = getProductEmojiOrNull(name);
  if (auto) return { emoji: auto, source: "name" };
  return { emoji: FALLBACK_PRODUCT_EMOJI, source: "fallback" };
}

// Row indexes of the rows with the same product name as `index` (itself
// included): picking an icon on one row of the import preview picks it for
// all of them.
export function rowsWithSameName(names: ReadonlyArray<string>, index: number): number[] {
  const key = productEmojiKey(names[index] ?? "");
  if (!key) return [index];
  const out: number[] = [];
  names.forEach((n, i) => {
    if (productEmojiKey(n) === key) out.push(i);
  });
  return out;
}
