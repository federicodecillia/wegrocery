import Link from "next/link";
import { brand as staticBrand } from "@/lib/brand";
import { getBrand } from "@/lib/brand/get-brand";
import { t } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { AdminGuideCard } from "@/components/guide/admin-guide-card";
import { GroupInfoCard } from "@/components/guide/group-info-card";
import { GuideContact } from "@/components/guide/guide-contact";
import { GuideSearch } from "@/components/guide/guide-search";
import { RichText } from "@/components/guide/rich-text";
import { GuideTopicGrid } from "@/components/guide/topic-grid";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { loadChangelog, visibleChangelog } from "@/lib/changelog";
import { guideContent } from "@/lib/guide";
import { adminGuideFor } from "@/lib/guide/admin";
import { GROUP_INFO_SLUG } from "@/lib/guide/group-info";
import { ADMIN_GUIDE_SECTION, buildSearchIndex, groupInfoSearchEntry } from "@/lib/guide/search";
import { WELCOME_QUERY } from "@/lib/guide/welcome";
import { guideContext, visibleGuide } from "@/lib/guide/types";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import type { Metadata } from "next";

export const metadata: Metadata = { title: t.guide.title };

// The guide's index: the group's own text ("Il nostro gruppo", written by the
// admins), search, topics, the latest release and the contacts.
// Cards live on the topic pages (app/guida/[topic]); only the ones this
// deploy's settings make relevant are shown or searched. An admin also gets
// the way into the admin guide and its cards in the search; for anyone else
// adminGuideFor returns null, so not a word of it reaches the page.
export default async function GuidaPage() {
  const brand = await getBrand();
  const session = await requireUserSession();
  const role = getUserRole(session);

  // Pull the most recent released version (skip the [Unreleased] block) for
  // the teaser, in the deploy's locale — same default as /changelog, where
  // users can still switch language explicitly.
  const [versions, settings] = await Promise.all([loadChangelog(staticBrand.locale), getPaymentSettings()]);
  const ctx = guideContext(settings);
  const guide = visibleGuide(guideContent, ctx);
  const adminGuideContent = adminGuideFor(session.user);
  const adminGuide = adminGuideContent && visibleGuide(adminGuideContent, ctx);
  // Changes for members only (Playbook 4.6): the latest release that has any.
  const latest = visibleChangelog(versions, false).find((v) => v.date !== null && v.sections.length > 0) ?? null;
  const topicTitles: Record<string, string> = Object.fromEntries(
    guide.topics.map((topic) => [topic.id, topic.title]),
  );
  const index = buildSearchIndex(guide.articles);
  if (settings.groupInfo) {
    index.unshift(groupInfoSearchEntry(t.guide.groupTitle, settings.groupInfo));
    topicTitles[GROUP_INFO_SLUG] = brand.appName;
  }
  if (adminGuide) {
    index.push(...buildSearchIndex(adminGuide.articles, ADMIN_GUIDE_SECTION));
    for (const topic of adminGuide.topics) {
      topicTitles[`${ADMIN_GUIDE_SECTION}${topic.id}`] = t.guide.adminTopicLabel(topic.title);
    }
  }

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin={role === "admin"} memberId={session.user.memberId!} personId={session.user.personId}>
      <h1 className="mb-1 text-title font-black text-foreground">
        {t.guide.title}
      </h1>
      <p className="mb-5 text-[14px] leading-snug text-secondary-foreground">{t.guide.intro}</p>

      <GuideSearch
        index={index}
        synonyms={adminGuide ? [...guide.synonyms, ...adminGuide.synonyms] : guide.synonyms}
        stopwords={guide.stopwords}
        topicTitles={topicTitles}
      >
        {adminGuide && <AdminGuideCard />}
        {settings.groupInfo && <GroupInfoCard text={settings.groupInfo} />}

        <GuideTopicGrid guide={guide} />
        <p className="-mt-3 mb-6 text-right">
          <Link href={`/?${WELCOME_QUERY}=1`} className="text-[12px] font-bold text-primary-text hover:underline">
            👋 {t.welcome.reopen}
          </Link>
        </p>

        {/* Novità: teaser of the latest release, linking the changelog */}
        {latest && (
          <section className="mb-6 overflow-hidden rounded-card border border-primary-mid bg-primary-bg">
            <div className="flex items-baseline justify-between gap-2 border-b border-primary-mid/40 px-4.5 py-3">
              <div>
                <div className="font-mono text-label uppercase tracking-[0.13em] text-primary-text">
                  {t.guide.newsTitle} · v{latest.version}
                </div>
                <h2 className="mt-0.5 text-[15px] font-black tracking-[-0.01em] text-foreground">
                  {t.guide.newsSubtitle}
                </h2>
              </div>
              {latest.date && <span className="tabular-nums text-label text-secondary-foreground">{latest.date}</span>}
            </div>
            <div className="space-y-3 px-4.5 py-4">
              {latest.tagline && (
                <p className="text-[12px] italic leading-[1.45] text-secondary-foreground">{latest.tagline}</p>
              )}
              {latest.sections.slice(0, 2).map((s) => (
                <div key={s.heading}>
                  <div className="mb-1 font-mono text-label font-bold uppercase tracking-wide text-primary-text">
                    {s.heading}
                  </div>
                  <ul className="space-y-1.5">
                    {s.items.slice(0, 4).map((item, idx) => (
                      <li key={idx} className="text-[14px] leading-[1.45] text-foreground">
                        <RichText text={item.text} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-primary-mid/40 px-4.5 py-3 text-center">
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
