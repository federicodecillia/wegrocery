// The home-screen icons of the installable app, drawn from the brand's logo
// (app/icons/[file]/route.tsx), so every deployment gets its own without a
// file in the repository. Served under /icons/*.png: proxy.ts lets .png
// through, and the browser fetches them without the session cookie.

export type PwaIcon = {
  file: string;
  size: number;
  purpose: "any" | "maskable";
  // Share of the side the logo takes: a maskable icon keeps its content in
  // the central safe zone (a square inside the 80% circle), Apple adds no
  // padding of its own.
  logoScale: number;
};

export const MANIFEST_ICONS: readonly PwaIcon[] = [
  { file: "192.png", size: 192, purpose: "any", logoScale: 0.86 },
  { file: "512.png", size: 512, purpose: "any", logoScale: 0.86 },
  { file: "maskable-512.png", size: 512, purpose: "maskable", logoScale: 0.56 },
];

export const APPLE_TOUCH_ICON: PwaIcon = { file: "apple-180.png", size: 180, purpose: "any", logoScale: 0.8 };

export const ALL_ICONS: readonly PwaIcon[] = [...MANIFEST_ICONS, APPLE_TOUCH_ICON];

export const iconPath = (icon: PwaIcon) => `/icons/${icon.file}`;

export function findIcon(file: string): PwaIcon | null {
  return ALL_ICONS.find((i) => i.file === file) ?? null;
}

// A logo under public/ is read from disk; anything else is fetched.
export function localLogoPath(logoUrl: string): string | null {
  if (!logoUrl.startsWith("/") || logoUrl.startsWith("//")) return null;
  const path = logoUrl.split(/[?#]/)[0];
  return path.split("/").some((part) => part === "..") ? null : path;
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
};

export function logoMimeType(path: string): string {
  const ext = path.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "image/png";
}

// The letter drawn when the logo cannot be loaded, so a build never fails on it.
export function fallbackInitial(shortName: string): string {
  return (shortName.trim()[0] ?? "?").toUpperCase();
}
