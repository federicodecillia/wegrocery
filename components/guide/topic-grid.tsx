import Link from "next/link";
import { UiIcon, topicIcon } from "@/components/ui-icon";
import { t } from "@/lib/i18n";
import type { GuideContent } from "@/lib/guide/types";

// The topics of a guide as cards with their card count: the member guide
// (/guida) and the admin guide (/guida/admin, section "admin/").
export function GuideTopicGrid({ guide, section = "" }: { guide: GuideContent; section?: string }) {
  return (
    <>
      <h2 className="mb-3 font-mono text-label uppercase tracking-[0.13em] text-secondary-foreground">{t.guide.topicsTitle}</h2>
      <ul className="mb-6 grid gap-3 sm:grid-cols-2">
        {guide.topics.map((topic) => {
          const count = guide.articles.filter((a) => a.topic === topic.id).length;
          return (
            <li key={topic.id}>
              <Link
                href={`/guida/${section}${topic.id}`}
                className="flex h-full gap-3 rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:border-primary-mid"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-bg text-primary-text">
                  <UiIcon name={topicIcon(`${section}${topic.id}`)} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold text-foreground">{topic.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-secondary-foreground">{topic.summary}</span>
                  <span className="mt-1 block tabular-nums text-label text-muted-foreground">{t.guide.topicCount(count)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
