"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { t } from "@/lib/i18n";
import { recordGuideSearchMiss } from "@/lib/actions/guide";
import { searchGuide, type GuideSearchEntry } from "@/lib/guide/search";
import { missQuery } from "@/lib/guide/search-misses";

type Props = {
  index: GuideSearchEntry[];
  synonyms: string[][];
  stopwords: string[];
  topicTitles: Record<string, string>;
  // The guide's index (topics, news, contacts), shown while nothing is typed.
  children: ReactNode;
};

// The search box of /guida: results replace the topic list as the member
// types, and each result opens its card on the topic page.
export function GuideSearch({ index, synonyms, stopwords, topicTitles, children }: Props) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchGuide(index, query, { synonyms, stopwords }),
    [index, query, synonyms, stopwords],
  );
  const searching = query.trim().length > 0;

  // A search that still finds nothing once the member stops typing is
  // counted, without who searched (admin → Impostazioni), once per page.
  const sentMisses = useRef(new Set<string>());
  const missed = searching && results.length === 0 ? missQuery(query) : null;
  useEffect(() => {
    if (!missed || sentMisses.current.has(missed)) return;
    const timer = setTimeout(() => {
      sentMisses.current.add(missed);
      void recordGuideSearchMiss(missed);
    }, 1500);
    return () => clearTimeout(timer);
  }, [missed]);

  return (
    <>
      <div className="relative mb-6">
        <label htmlFor="guide-search" className="sr-only">
          {t.guide.searchLabel}
        </label>
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="guide-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.guide.searchPlaceholder}
          autoComplete="off"
          enterKeyHint="search"
          className="w-full rounded-full border border-brand-border bg-white py-3 pl-11 pr-11 text-[14px] text-brand-near-black shadow-[0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t.guide.searchClear}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-brand-warm-white"
          >
            ✕
          </button>
        )}
      </div>

      {searching ? (
        <section aria-live="polite">
          <p className="mb-3 font-mono text-label uppercase tracking-[0.13em] text-brand-gray">
            {results.length > 0 ? t.guide.searchResults(results.length) : null}
          </p>
          {results.length === 0 ? (
            <p className="rounded-[18px] border border-brand-border bg-white p-[18px] text-[14px] leading-[1.5] text-brand-gray">
              {t.guide.searchEmpty}
              <span className="mt-2 block text-[12px] text-muted">{t.guide.searchMissNote}</span>
            </p>
          ) : (
            <ul className="overflow-hidden rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {results.map(({ entry }) => (
                <li key={entry.slug} className="border-b border-brand-border last:border-b-0">
                  {/* A full navigation, not next/link: only a real load sets :target,
                      which highlights the card on the topic page. */}
                  <a
                    href={entry.href}
                    // A result on this very page (Il nostro gruppo) only changes
                    // the hash: show the index first, so the card exists when
                    // the browser scrolls to it.
                    onClick={entry.href.startsWith("/guida#") ? () => flushSync(() => setQuery("")) : undefined}
                    className="block px-4 py-[12px] hover:bg-brand-warm-white"
                  >
                    <span className="block text-[14px] font-semibold text-brand-near-black">{entry.title}</span>
                    <span className="mt-[2px] block text-[12px] text-brand-gray">{topicTitles[entry.topic]}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        children
      )}
    </>
  );
}
