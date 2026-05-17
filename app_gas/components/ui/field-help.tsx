"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small "?" pill that toggles a one-line tooltip with a usage hint.
 * Designed for form labels — pair with text labels like:
 *
 *   <label>Formato <FieldHelp text="Es: Sacco 2kg, Cestino, Mazzo" /></label>
 *
 * Tap-friendly on mobile (uses click, not hover) and dismisses on outside
 * click or Escape.
 */
export function FieldHelp({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative ml-1 inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        aria-label="Mostra aiuto"
        aria-expanded={open}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-pm-border bg-white text-[9px] font-bold leading-none text-pm-gray hover:border-pm-teal hover:text-pm-teal focus:outline-none focus:ring-2 focus:ring-pm-teal/30"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          onMouseLeave={() => setOpen(false)}
          className="absolute left-1/2 top-full z-50 mt-1.5 w-[220px] -translate-x-1/2 rounded-md border border-pm-border bg-white px-2.5 py-1.5 text-[11px] leading-snug font-normal normal-case tracking-normal text-pm-near-black shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
