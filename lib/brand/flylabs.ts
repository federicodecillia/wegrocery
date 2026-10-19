import { flylabsHref } from "@/components/by-flylabs";
import type { BrandConfig } from "./types";

// Where the "by flylabs.ai" signature links (Playbook 2.11): WeGrocery's page
// on flylabs.ai in the group's language. There is no such page yet, so it is
// the flylabs.ai home: set the slug (e.g. "wegrocery") once the page exists.
export const FLYLABS_PRODUCT_SLUG: string | undefined = undefined;

export function flylabsProductUrl(locale: BrandConfig["locale"]): string {
  return flylabsHref(locale, FLYLABS_PRODUCT_SLUG);
}
