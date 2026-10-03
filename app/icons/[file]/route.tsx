import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { brand, resolvePalette } from "@/lib/brand";
import { reportError } from "@/lib/observability";
import { ALL_ICONS, fallbackInitial, findIcon, localLogoPath, logoMimeType } from "@/lib/pwa/icons";

// The installable app's icons, drawn at build time from the brand's logo on
// the app background (lib/pwa/icons.ts lists them).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_ICONS.map((icon) => ({ file: icon.file }));
}

async function logoDataUri(): Promise<string | null> {
  try {
    const local = localLogoPath(brand.logoUrl);
    if (local) {
      const bytes = await readFile(path.join(process.cwd(), "public", local));
      return `data:${logoMimeType(local)};base64,${bytes.toString("base64")}`;
    }
    const response = await fetch(brand.logoUrl);
    if (!response.ok) throw new Error(`logo answered ${response.status}`);
    const type = response.headers.get("content-type")?.split(";")[0] || logoMimeType(brand.logoUrl);
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch (e) {
    reportError("pwa icon logo", e);
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const icon = findIcon((await params).file);
  if (!icon) notFound();
  const logo = await logoDataUri();
  const side = Math.round(icon.size * icon.logoScale);
  const palette = resolvePalette(brand.theme);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.theme.background ?? "#faf8f5",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={logo} width={side} height={side} style={{ objectFit: "contain" }} />
        ) : (
          <div style={{ fontSize: side * 0.7, fontWeight: 800, color: palette.primary }}>{fallbackInitial(brand.shortName)}</div>
        )}
      </div>
    ),
    { width: icon.size, height: icon.size },
  );
}
