// Search over the member guide, run in the browser as the member types.
// Pure, so it is unit tested. Matching ignores case, accents and **bold**
// marks; a word also finds its synonyms and, when long, its other endings
// ("ricarico" finds "ricaricare").

import { GROUP_INFO_SLUG } from "./group-info";
import type { GuideArticle, GuideContent } from "./types";

export type GuideSearchEntry = {
  slug: string;
  topic: string;
  title: string;
  // Where the result opens: the card on its topic page.
  href: string;
  // Normalized texts, ready to match.
  titleText: string;
  keywordText: string;
  bodyText: string;
};

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildSearchIndex(articles: GuideArticle[]): GuideSearchEntry[] {
  return articles.map((a) => ({
    slug: a.slug,
    topic: a.topic,
    title: a.title,
    href: `/guida/${a.topic}#${a.slug}`,
    titleText: ` ${normalizeText(a.title)} `,
    keywordText: ` ${normalizeText((a.keywords ?? []).join(" "))} `,
    bodyText: ` ${normalizeText([a.intro ?? "", ...(a.steps ?? []), ...(a.notes ?? [])].join(" "))} `,
  }));
}

// The group's own text (lib/guide/group-info.ts) as one more result, opening
// its card at the top of /guida. Its words weigh like a card's title, keywords
// and body at once: on "ritiro" the group's own answer (where, when) comes
// before the generic cards, and first on a tie.
export function groupInfoSearchEntry(title: string, text: string): GuideSearchEntry {
  const words = ` ${normalizeText(text)} `;
  return {
    slug: GROUP_INFO_SLUG,
    topic: GROUP_INFO_SLUG,
    title,
    href: `/guida#${GROUP_INFO_SLUG}`,
    titleText: ` ${normalizeText(title)}${words}`,
    keywordText: words,
    bodyText: words,
  };
}

// The forms of one query word that count as a hit: the word, its stem when
// long enough, and every member of a synonym group it belongs to.
function variants(word: string, synonyms: string[][]): string[] {
  const out = new Set([word]);
  if (word.length >= 6) out.add(word.slice(0, -2));
  for (const group of synonyms) {
    const normalized = group.map(normalizeText);
    if (normalized.some((s) => s === word || (word.length >= 4 && s.startsWith(word)))) {
      for (const s of normalized) out.add(s);
    }
  }
  return [...out];
}

// A variant hits when a word of the text starts with it.
function hits(text: string, forms: string[]): boolean {
  return forms.some((f) => text.includes(` ${f}`));
}

export type GuideSearchResult = { entry: GuideSearchEntry; score: number };

export function searchGuide(
  index: GuideSearchEntry[],
  query: string,
  { synonyms, stopwords }: Pick<GuideContent, "synonyms" | "stopwords">,
): GuideSearchResult[] {
  const stop = new Set(stopwords.map(normalizeText));
  const words = normalizeText(query)
    .split(" ")
    .filter((w) => w.length >= 2 && !stop.has(w));
  if (words.length === 0) return [];
  const forms = words.map((w) => variants(w, synonyms));

  const scored = index.map((entry) => {
    let matched = 0;
    let score = 0;
    for (const f of forms) {
      const inTitle = hits(entry.titleText, f);
      const inKeywords = hits(entry.keywordText, f);
      const inBody = hits(entry.bodyText, f);
      if (inTitle || inKeywords || inBody) matched += 1;
      score += (inTitle ? 3 : 0) + (inKeywords ? 2 : 0) + (inBody ? 1 : 0);
    }
    return { entry, matched, score };
  });
  // Cards that match every word, if any; otherwise the best partial matches.
  const best = Math.max(0, ...scored.map((s) => s.matched));
  if (best === 0) return [];
  return scored
    .filter((s) => s.matched === best)
    .sort((a, b) => b.score - a.score)
    .map(({ entry, score }) => ({ entry, score }));
}
