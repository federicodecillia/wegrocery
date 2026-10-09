"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

/** The id of a category's section on the order page. */
export function categoryAnchor(category: string): string {
  return `cat-${encodeURIComponent(category || "none")}`;
}

// The order page's chip row, sticky at the top while the list scrolls: "Nel
// carrello (3)" filters the list, then one chip per category jumps to it
// and lights up while its section is under the bar. The row scrolls
// sideways on its own; the page never does.
export function CategoryBar({
  categories,
  cartCount,
  onlyCart,
  onToggleCart,
  labelOf,
}: {
  categories: string[];
  cartCount: number;
  onlyCart: boolean;
  onToggleCart: () => void;
  labelOf: (category: string) => string;
}) {
  const [active, setActive] = useState<string | null>(null);
  // While a jump scrolls, the chip tapped stays lit (a short last section
  // may never reach the band).
  const jumpedAt = useRef(0);
  const row = useRef<HTMLUListElement>(null);

  // Keep the lit chip inside the row (sideways only: the page must not move).
  useEffect(() => {
    const ul = row.current;
    const chip = ul?.querySelector<HTMLElement>("[aria-current=true]");
    if (!ul || !chip) return;
    const left = chip.offsetLeft - ul.offsetLeft;
    if (left < ul.scrollLeft || left + chip.offsetWidth > ul.scrollLeft + ul.clientWidth) {
      ul.scrollTo({ left: Math.max(0, left - 20), behavior: "smooth" });
    }
  }, [active]);
  const named = categories.filter(Boolean);
  const key = named.join("\n");

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-category]"));
    if (sections.length === 0) return;
    // A band just under the bar: the section crossing it is the current one.
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit && performance.now() - jumpedAt.current > 1000) setActive((hit.target as HTMLElement).dataset.category ?? null);
      },
      { rootMargin: "-72px 0px -65% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [key, onlyCart]);

  function jump(category: string, at: number) {
    const target = document.getElementById(categoryAnchor(category));
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    jumpedAt.current = at;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActive(category);
  }

  const chip = "hit-44 inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold";

  return (
    <nav
      aria-label={t.order.categoriesAria}
      className="sticky top-0 z-[5] -mx-5 mt-3 border-b border-brand-border bg-brand-warm-white"
    >
      <ul ref={row} className="flex gap-2 overflow-x-auto px-5 py-2 [scrollbar-width:none]">
        {cartCount > 0 && (
          <li>
            <button
              type="button"
              aria-pressed={onlyCart}
              onClick={onToggleCart}
              className={`${chip} ${onlyCart ? "border-primary bg-primary text-on-primary" : "border-primary-mid bg-primary-soft text-primary-text"}`}
            >
              {t.order.inCart(cartCount)}
            </button>
          </li>
        )}
        {named.length > 1 &&
          named.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={(e) => jump(c, e.timeStamp)}
                aria-current={active === c ? "true" : undefined}
                className={`${chip} ${
                  active === c ? "border-brand-near-black bg-brand-near-black text-white" : "border-brand-border bg-white text-brand-gray"
                }`}
              >
                {labelOf(c)}
              </button>
            </li>
          ))}
      </ul>
    </nav>
  );
}
