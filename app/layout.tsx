import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/providers/toaster";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { brand, deriveRoleVars, resolvePalette } from "@/lib/brand";
import { APPLE_TOUCH_ICON, iconPath } from "@/lib/pwa/icons";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: brand.appName,
    template: `%s · ${brand.shortName}`,
  },
  description: brand.description,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: brand.shortName,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The safe-area insets (env(safe-area-inset-*)) are only non-zero with "cover".
  viewportFit: "cover",
  themeColor: resolvePalette(brand.theme).primary,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={brand.locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={deriveRoleVars(brand.theme) as React.CSSProperties}
    >
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href={iconPath(APPLE_TOUCH_ICON)} />
      </head>
      <body className="text-brand-near-black flex min-h-full flex-col">
        {children}
        <Toaster />
        <ConfirmDialogProvider />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
