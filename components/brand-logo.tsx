"use client";

import { useState } from "react";
import { fallbackInitial } from "@/lib/pwa/icons";

// The brand logo on the login page. A logo that cannot be loaded becomes the
// same letter the app icons draw (lib/pwa/icons.ts), never a broken image.
export function BrandLogo({ src, alt, shortName, size = 56 }: { src: string; alt: string; shortName: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
        style={{ width: size, height: size, fontSize: size * 0.55 }}
        className="flex items-center justify-center rounded-2xl bg-primary-soft font-black text-primary-text"
      >
        {fallbackInitial(shortName)}
      </span>
    );
  }
  return (
    // A plain img: the logo may be any URL from the brand JSON, and onError
    // must fire for the fallback.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} height={size} style={{ height: size }} className="w-auto max-w-[200px] object-contain" onError={() => setFailed(true)} />
  );
}
