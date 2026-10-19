import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { GuideArticleCard } from "@/components/guide/guide-article";
import { UiIcon, topicIcon } from "@/components/ui-icon";
import { BackLink } from "@/components/ui/back-link";
import { ADMIN_GUIDE_HREF } from "@/lib/admin/nav";
import { requireUserSession } from "@/lib/auth/session";
import { adminGuideFor } from "@/lib/guide/admin";
import { ADMIN_GUIDE_SECTION } from "@/lib/guide/search";
import { guideContext, visibleGuide } from "@/lib/guide/types";
import { t } from "@/lib/i18n";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import type { Metadata } from "next";

// The generic guide title: the tab title is sent before the role check
// answers, so it must not name anything of the admin guide.
export const metadata: Metadata = { title: t.guide.title };

// One topic of the admin guide: its cards, then the other topics. A 404 for
// anyone but an active admin, and for a topic this deploy does not show.
export default async function AdminGuideTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const session = await requireUserSession();
  const content = adminGuideFor(session.user);
  if (!content) notFound();
  const [{ topic: topicId }, settings] = await Promise.all([params, getPaymentSettings()]);
  const guide = visibleGuide(content, guideContext(settings));
  const topic = guide.topics.find((x) => x.id === topicId);
  if (!topic) notFound();
  const articles = guide.articles.filter((a) => a.topic === topic.id);

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin memberId={session.user.memberId!} personId={session.user.personId}>
      <div className="mb-4">
        <BackLink href={ADMIN_GUIDE_HREF}>{t.guide.backToAdminGuide}</BackLink>
      </div>
      <h1 className="mb-1 flex items-center gap-2 text-title font-black text-foreground">
        <span className="text-primary-text">
          <UiIcon name={topicIcon(`${ADMIN_GUIDE_SECTION}${topic.id}`)} className="h-6 w-6" />
        </span>
        {topic.title}
      </h1>
      <p className="mb-5 text-[14px] leading-snug text-secondary-foreground">{topic.summary}</p>

      {articles.map((article) => (
        <GuideArticleCard key={article.slug} article={article} />
      ))}

      <h2 className="mb-3 mt-6 font-mono text-label uppercase tracking-[0.13em] text-secondary-foreground">{t.guide.otherTopics}</h2>
      <div className="flex flex-wrap gap-2">
        {guide.topics
          .filter((x) => x.id !== topic.id)
          .map((x) => (
            <Link
              key={x.id}
              href={`${ADMIN_GUIDE_HREF}/${x.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-bold text-foreground hover:border-primary-mid"
            >
              <UiIcon name={topicIcon(`${ADMIN_GUIDE_SECTION}${x.id}`)} className="h-4 w-4 text-primary-text" />
              {x.title}
            </Link>
          ))}
      </div>
    </AppShell>
  );
}
