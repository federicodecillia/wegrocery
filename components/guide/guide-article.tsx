import Link from "next/link";
import type { GuideArticle } from "@/lib/guide/types";
import { RichText } from "./rich-text";

// One card of a guide topic (app/guida/[topic]): the answer, the numbered
// steps, the notes and a direct link into the app. The id is the anchor that
// search results jump to; :target highlights the card they opened.
export function GuideArticleCard({ article }: { article: GuideArticle }) {
  return (
    <article
      id={article.slug}
      className="mb-[14px] scroll-mt-24 rounded-[18px] border border-brand-border bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] target:border-primary target:ring-2 target:ring-primary/20"
    >
      <h2 className="mb-2 text-[16px] font-extrabold tracking-[-0.01em] text-brand-near-black">{article.title}</h2>
      {article.intro && (
        <p className="mb-3 text-[14px] leading-[1.5] text-brand-near-black">
          <RichText text={article.intro} />
        </p>
      )}
      {article.steps && (
        <ol className="mb-3 space-y-[10px]">
          {article.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent font-mono text-label font-bold text-on-accent"
              >
                {i + 1}
              </span>
              <p className="mt-[2px] text-[14px] leading-[1.5] text-brand-near-black">
                <RichText text={step} />
              </p>
            </li>
          ))}
        </ol>
      )}
      {article.notes?.map((note, i) => (
        <p key={i} className="mb-3 text-[14px] leading-[1.5] text-brand-gray">
          <RichText text={note} />
        </p>
      ))}
      {article.link && (
        <Link
          href={article.link.href}
          className="inline-flex items-center gap-1 text-[14px] font-bold text-primary-text hover:underline"
        >
          {article.link.label} →
        </Link>
      )}
    </article>
  );
}
