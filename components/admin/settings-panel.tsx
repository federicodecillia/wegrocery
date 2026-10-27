"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// The cards' own frame, dropped inside a panel (also a form's inner section).
const BARE =
  "[&>*]:shadow-none [&>form]:rounded-none [&>form]:border-0 [&>form]:bg-transparent [&>form]:p-0 [&>section]:rounded-none [&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0 [&>form>section]:rounded-none [&>form>section]:border-0 [&>form>section]:bg-transparent [&>form>section]:p-0";
// One card: the panel's title replaces its own.
const SINGLE = "space-y-4 [&>form>h3]:sr-only [&>section>h3]:sr-only [&>section>fieldset>legend]:sr-only";
// Several cards: each keeps its title, a line between them.
// (important: the frame reset above would otherwise win over them).
const STACKED = "[&>*]:py-4! [&>*:first-child]:pt-0! [&>*:last-child]:pb-0! [&>*+*]:border-t! [&>*+*]:border-border!";

// One block of Admin → Impostazioni: a title and a line with what is set now,
// folded until opened. It opens by itself when the URL's #anchor points into
// it (old links such as #cicli-carta). The open state lives here, outside the
// forms a save remounts, so a block stays open after saving. The cards inside
// keep their own look in the first-run setup; here their frame and title give
// way to the panel's (the title stays for screen readers).
export function SettingsPanel({
  id,
  title,
  summary,
  defaultOpen = false,
  attention = false,
  stacked = false,
  children,
}: {
  id: string;
  title: string;
  /** The values set now, on one line: what an admin checks without opening. */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  /** Something to fix inside: the summary reads as a warning. */
  attention?: boolean;
  /** Several cards in one panel: their titles stay, as sub-headings, with a line between them. */
  stacked?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || attention);
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const reveal = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash || !ref.current) return;
      const target = document.getElementById(hash);
      if (target && ref.current.contains(target)) {
        setOpen(true);
        requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
      }
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

  return (
    <details
      ref={ref}
      id={id}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group scroll-mt-4 rounded-xl border border-border bg-card"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[14px] font-bold text-foreground">{title}</span>
          {summary && (
            <span
              className={`mt-0.5 block text-[12px] ${attention ? "font-semibold text-destructive" : "text-secondary-foreground"}`}
            >
              {summary}
            </span>
          )}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-secondary-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className={`border-t border-border px-4 py-4 ${BARE} ${stacked ? STACKED : SINGLE}`}>{children}</div>
    </details>
  );
}

/** Small round swatches of the group's colours, for a summary line. */
export function ColorDots({ colors }: { colors: string[] }) {
  return (
    <span className="ml-1 inline-flex translate-y-0.5 gap-1 align-baseline" aria-hidden>
      {colors.map((c, i) => (
        <span key={`${c}-${i}`} className="inline-block size-3 rounded-full border border-border" style={{ background: c }} />
      ))}
    </span>
  );
}
