"use client";

import { useState } from "react";

type Faq = { q: string; a: string };

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div>
      {faqs.map((faq, i) => (
        <div key={i} className="border-b border-brand-border">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between py-[14px] text-left"
            aria-expanded={open === i}
          >
            <span className="pr-4 text-[14px] font-semibold text-brand-near-black">{faq.q}</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`flex-shrink-0 text-muted transition-transform duration-150 ${
                open === i ? "rotate-180" : ""
              }`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open === i && (
            <p className="pb-[14px] text-[13px] leading-relaxed text-brand-gray">{faq.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}
