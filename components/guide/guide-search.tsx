"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { t } from "@/lib/i18n";
import { recordGuideSearchMiss } from "@/lib/actions/guide";
import { searchGuide, type GuideSearchEntry } from "@/lib/guide/search";
import { missQuery } from "@/lib/guide/search-misses";
import { Input } from "@/components/ui/input";

type Props = {
  index: GuideSearchEntry[];
  synonyms: string[][];
  stopwords: string[];
  topicTitles: Record<string, string>;
  placeholder?: string;
  // The guide's index (topics, news, contacts), shown while nothing is typed.
  children: ReactNode;
};

// The search box of /guida: results replace the topic list as the member
// types, and each result opens its card on the topic page.
export function GuideSearch({ index, synonyms, stopwords, topicTitles, placeholder = t.guide.searchPlaceholder, children }: Props) {
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
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="guide-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="rounded-full py-3 pl-11 pr-11 shadow-card focus:border-primary [&::-webkit-search-cancel-button]:hidden"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t.guide.searchClear}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-background"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>

      {searching ? (
        <section aria-live="polite">
          <p className="mb-3 font-mono text-label uppercase tracking-[0.13em] text-secondary-foreground">
            {results.length > 0 ? t.guide.searchResults(results.length) : null}
          </p>
          {results.length === 0 ? (
            <p className="rounded-card border border-border bg-card p-4.5 text-[14px] leading-[1.5] text-secondary-foreground">
              {t.guide.searchEmpty}
              <span className="mt-2 block text-[12px] text-muted-foreground">{t.guide.searchMissNote}</span>
            </p>
          ) : (
            <ul className="overflow-hidden rounded-card border border-border bg-card shadow-card">
              {results.map(({ entry }) => (
                <li key={entry.slug} className="border-b border-border last:border-b-0">
                  {/* A full navigation, not next/link: only a real load sets :target,
                      which highlights the card on the topic page. */}
                  <a
                    href={entry.href}
                    // A result on this very page (Il nostro gruppo) only changes
                    // the hash: show the index first, so the card exists when
                    // the browser scrolls to it.
                    onClick={entry.href.startsWith("/guida#") ? () => flushSync(() => setQuery("")) : undefined}
                    className="block px-4 py-3 hover:bg-background"
                  >
                    <span className="block text-[14px] font-semibold text-foreground">{entry.title}</span>
                    <span className="mt-0.5 block text-[12px] text-secondary-foreground">{topicTitles[entry.topic]}</span>
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
