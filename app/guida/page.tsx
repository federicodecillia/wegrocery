import Link from "next/link";
import { UiIcon, topicIcon } from "@/components/ui-icon";
import { brand as staticBrand } from "@/lib/brand";
import { getBrand } from "@/lib/brand/get-brand";
import { t } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { GroupInfoCard } from "@/components/guide/group-info-card";
import { GuideContact } from "@/components/guide/guide-contact";
import { GuideSearch } from "@/components/guide/guide-search";
import { RichText } from "@/components/guide/rich-text";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { loadChangelog } from "@/lib/changelog";
import { guideContent } from "@/lib/guide";
import { GROUP_INFO_SLUG } from "@/lib/guide/group-info";
import { buildSearchIndex, groupInfoSearchEntry } from "@/lib/guide/search";
import { WELCOME_QUERY } from "@/lib/guide/welcome";
import { guideContext, visibleGuide } from "@/lib/guide/types";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import type { Metadata } from "next";

export const metadata: Metadata = { title: t.guide.title };

// The guide's index: the group's own text ("Il nostro gruppo", written by the
// admins), search, topics, the latest release and the contacts.
// Cards live on the topic pages (app/guida/[topic]); only the ones this
// deploy's settings make relevant are shown or searched.
export default async function GuidaPage() {
  const brand = await getBrand();
  const session = await requireUserSession();
  const role = getUserRole(session);

  // Pull the most recent released version (skip the [Unreleased] block) for
  // the teaser, in the deploy's locale — same default as /changelog, where
  // users can still switch language explicitly.
  const [versions, settings] = await Promise.all([loadChangelog(staticBrand.locale), getPaymentSettings()]);
  const guide = visibleGuide(guideContent, guideContext(settings));
  const latest = versions.find((v) => v.date !== null) ?? null;
  const topicTitles: Record<string, string> = Object.fromEntries(
    guide.topics.map((topic) => [topic.id, topic.title]),
  );
  const index = buildSearchIndex(guide.articles);
  if (settings.groupInfo) {
    index.unshift(groupInfoSearchEntry(t.guide.groupTitle, settings.groupInfo));
    topicTitles[GROUP_INFO_SLUG] = brand.appName;
  }

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin={role === "admin"} memberId={session.user.memberId!} personId={session.user.personId}>
      <h1 className="mb-1 text-title font-black text-brand-near-black">
        {t.guide.title}
      </h1>
      <p className="mb-5 text-[14px] leading-snug text-brand-gray">{t.guide.intro}</p>

      <GuideSearch
        index={index}
        synonyms={guide.synonyms}
        stopwords={guide.stopwords}
        topicTitles={topicTitles}
      >
        {settings.groupInfo && <GroupInfoCard text={settings.groupInfo} />}

        <h2 className="mb-3 font-mono text-label uppercase tracking-[0.13em] text-brand-gray">{t.guide.topicsTitle}</h2>
        <ul className="mb-6 grid gap-3 sm:grid-cols-2">
          {guide.topics.map((topic) => {
            const count = guide.articles.filter((a) => a.topic === topic.id).length;
            return (
              <li key={topic.id}>
                <Link
                  href={`/guida/${topic.id}`}
                  className="flex h-full gap-3 rounded-card border border-brand-border bg-white p-4 shadow-card transition-colors hover:border-primary-mid"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
                    <UiIcon name={topicIcon(topic.id)} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold text-brand-near-black">{topic.title}</span>
                    <span className="mt-[2px] block text-[12px] leading-snug text-brand-gray">{topic.summary}</span>
                    <span className="mt-1 block font-mono text-label text-muted">{t.guide.topicCount(count)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="-mt-3 mb-6 text-right">
          <Link href={`/?${WELCOME_QUERY}=1`} className="text-[12px] font-bold text-primary-text hover:underline">
            👋 {t.welcome.reopen}
          </Link>
        </p>

        {/* Novità: teaser of the latest release, linking the changelog */}
        {latest && (
          <section className="mb-6 overflow-hidden rounded-card border border-primary-mid bg-primary-soft">
            <div className="flex items-baseline justify-between gap-2 border-b border-primary-mid/40 px-[18px] py-3">
              <div>
                <div className="font-mono text-label uppercase tracking-[0.13em] text-primary-text">
                  {t.guide.newsTitle} · v{latest.version}
                </div>
                <h2 className="mt-0.5 text-[15px] font-black tracking-[-0.01em] text-brand-near-black">
                  {t.guide.newsSubtitle}
                </h2>
              </div>
              {latest.date && <span className="font-mono text-label text-brand-gray">{latest.date}</span>}
            </div>
            <div className="space-y-3 px-[18px] py-4">
              {latest.tagline && (
                <p className="text-[12px] italic leading-[1.45] text-brand-gray">{latest.tagline}</p>
              )}
              {latest.sections.slice(0, 2).map((s) => (
                <div key={s.heading}>
                  <div className="mb-1 font-mono text-label font-bold uppercase tracking-wide text-primary-text">
                    {s.heading}
                  </div>
                  <ul className="space-y-1.5">
                    {s.items.slice(0, 4).map((item, idx) => (
                      <li key={idx} className="text-[14px] leading-[1.45] text-brand-near-black">
                        <RichText text={item.text} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-primary-mid/40 px-[18px] py-3 text-center">
              <Link
                href="/changelog"
                className="inline-flex items-center gap-1 text-[12px] font-bold text-primary-text hover:underline"
              >
                {t.guide.seeAllNews}
              </Link>
            </div>
          </section>
        )}
      </GuideSearch>

      <GuideContact />
    </AppShell>
  );
}
