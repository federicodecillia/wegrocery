// The member guide (/guida): topics, task cards and the conditions that
// decide which cards a deploy shows. Pure (no I/O, no brand import) so the
// client search component can import it and it is unit tested.

import type { PaymentMode } from "@/lib/payments/settings";

// What a card needs from the deploy to make sense. Every listed key must
// match; a card without conditions is always shown.
export type GuideCondition = {
  mode?: PaymentMode;
  families?: boolean;
  onlineTopup?: boolean;
  bankTransfer?: boolean;
};

// The deploy's side of the conditions, read from the payment settings.
export type GuideContext = {
  mode: PaymentMode;
  families: boolean;
  onlineTopup: boolean;
  bankTransfer: boolean;
};

export type GuideTopic = {
  id: string;
  emoji: string;
  title: string;
  summary: string;
};

// One question or task. Texts may use **bold** for button and page names.
export type GuideArticle = {
  slug: string;
  topic: string;
  title: string;
  // A short answer, shown before the steps.
  intro?: string;
  // Numbered steps, for tasks.
  steps?: string[];
  // Paragraphs after the steps.
  notes?: string[];
  // A direct link into the app ("Apri Ricarica").
  link?: { href: string; label: string };
  // Words a member might type that are not in the text.
  keywords?: string[];
  when?: GuideCondition;
};

export type GuideContent = {
  topics: GuideTopic[];
  articles: GuideArticle[];
  // Groups of words that mean the same thing to a member: searching one finds
  // the others.
  synonyms: string[][];
  // Words that carry no meaning in a search ("come", "il").
  stopwords: string[];
};

export function isVisible(when: GuideCondition | undefined, ctx: GuideContext): boolean {
  if (!when) return true;
  return (Object.keys(when) as (keyof GuideCondition)[]).every((key) => when[key] === ctx[key]);
}

// The guide as this deploy shows it: hidden cards removed, and topics left
// without cards removed too.
export function visibleGuide(content: GuideContent, ctx: GuideContext): GuideContent {
  const articles = content.articles.filter((a) => isVisible(a.when, ctx));
  const used = new Set(articles.map((a) => a.topic));
  return { ...content, articles, topics: content.topics.filter((t) => used.has(t.id)) };
}

export function guideContext(settings: {
  mode: PaymentMode;
  familiesEnabled: boolean;
  onlineTopupAvailable: boolean;
  bankTransfer: unknown;
}): GuideContext {
  return {
    mode: settings.mode,
    families: settings.familiesEnabled,
    onlineTopup: settings.onlineTopupAvailable,
    bankTransfer: settings.bankTransfer !== null,
  };
}
