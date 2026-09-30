import type { MetadataRoute } from "next";
import { brand, resolvePalette } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.appName,
    short_name: brand.shortName,
    description: brand.description,
    start_url: "/",
    display: "standalone",
    background_color: brand.theme.background ?? "#faf8f5",
    theme_color: resolvePalette(brand.theme).primary,
    orientation: "portrait",
    icons: [
      { src: brand.logoUrl, sizes: "any", type: "image/png", purpose: "any" },
      { src: brand.logoUrl, sizes: "any", type: "image/png", purpose: "maskable" },
    ],
  };
}
