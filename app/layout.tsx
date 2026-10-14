import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/providers/toaster";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { cookies } from "next/headers";
import { brand, resolvePalette, roleVarsCss } from "@/lib/brand";
import { DARK } from "@/lib/brand/roles";
import { parseTheme, THEME_COOKIE, type Theme } from "@/lib/theme";
import { getBrand } from "@/lib/brand/get-brand";
import { APPLE_TOUCH_ICON, iconPath } from "@/lib/pwa/icons";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The identity the admins may have changed in the app (getBrand), read per
// request; language stays the deploy's.
export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return {
    title: {
      default: b.appName,
      template: `%s · ${b.shortName}`,
    },
    description: b.description,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: b.shortName,
    },
    formatDetection: { telephone: false },
  };
}

function themeColors(chosen: Theme, primary: string): Viewport["themeColor"] {
  if (chosen === "light") return primary;
  if (chosen === "dark") return DARK.background;
  return [
    { media: "(prefers-color-scheme: light)", color: primary },
    { media: "(prefers-color-scheme: dark)", color: DARK.background },
  ];
}

export async function generateViewport(): Promise<Viewport> {
  const b = await getBrand();
  const chosen = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return {
    width: "device-width",
    initialScale: 1,
    // The safe-area insets (env(safe-area-inset-*)) are only non-zero with "cover".
    viewportFit: "cover",
    // The browser's own bar: the group's colour in light, the page in dark.
    // With no choice made the device decides, so both are offered.
    themeColor: themeColors(chosen, resolvePalette(b.theme).primary),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const b = await getBrand();
  const chosen = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang={brand.locale}
      data-theme={chosen === "system" ? undefined : chosen}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: roleVarsCss(b.theme) }} />
        <link rel="apple-touch-icon" sizes="180x180" href={iconPath(APPLE_TOUCH_ICON)} />
      </head>
      <body className="text-brand-near-black flex min-h-full flex-col">
        {children}
        <Toaster />
        <ConfirmDialogProvider />
      </body>
    </html>
  );
}
