import { parseBrandConfig } from "./parse";
import { brandContrastWarnings } from "./roles";

// NEXT_PUBLIC_* is inlined at build time in client bundles and read from
// process.env on the server; each client deploy is its own build, so both
// sides always agree.
export const brand = parseBrandConfig(process.env.NEXT_PUBLIC_BRAND_JSON);

// Server only: the client bundle would repeat it in every browser console.
if (typeof window === "undefined") {
  for (const w of brandContrastWarnings(brand.theme)) console.warn(`[brand] ${w}`);
}

export { brandContrastWarnings, deriveRoleVars, resolvePalette } from "./roles";

export type { BrandConfig, BrandTheme } from "./types";
