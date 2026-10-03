import type { MetadataRoute } from "next";
import { brand, resolvePalette } from "@/lib/brand";
import { iconPath, MANIFEST_ICONS } from "@/lib/pwa/icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.appName,
    short_name: brand.shortName,
    description: brand.description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: brand.theme.background ?? "#faf8f5",
    theme_color: resolvePalette(brand.theme).primary,
    orientation: "portrait",
    icons: MANIFEST_ICONS.map((icon) => ({
      src: iconPath(icon),
      sizes: `${icon.size}x${icon.size}`,
      type: "image/png",
      purpose: icon.purpose,
    })),
  };
}
