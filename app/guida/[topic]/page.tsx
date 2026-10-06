import Link from "next/link";
import { notFound } from "next/navigation";
import { t } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { GuideArticleCard } from "@/components/guide/guide-article";
import { GuideContact } from "@/components/guide/guide-contact";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { guideContent } from "@/lib/guide";
import { guideContext, visibleGuide } from "@/lib/guide/types";
import { getPaymentSettings } from "@/lib/payments/get-settings";

// One topic of the guide: its cards, then the other topics. A topic this
// deploy does not show (families off) is a 404, like an unknown one.
export default async function GuideTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const [{ topic: topicId }, settings] = await Promise.all([params, getPaymentSettings()]);
  const guide = visibleGuide(guideContent, guideContext(settings));
  const topic = guide.topics.find((x) => x.id === topicId);
  if (!topic) notFound();
  const articles = guide.articles.filter((a) => a.topic === topic.id);

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin={role === "admin"} memberId={session.user.memberId!} personId={session.user.personId}>
      <div className="mb-4">
        <Link href="/guida" className="font-mono text-label font-bold uppercase tracking-widest text-brand-gray">
          ← {t.guide.backToGuide}
        </Link>
      </div>
      <h1 className="mb-1 flex items-center gap-2 text-[20px] font-black tracking-[-0.03em] text-brand-near-black">
        <span aria-hidden>{topic.emoji}</span>
        {topic.title}
      </h1>
      <p className="mb-5 text-[14px] leading-snug text-brand-gray">{topic.summary}</p>

      {articles.map((article) => (
        <GuideArticleCard key={article.slug} article={article} />
      ))}

      <h2 className="mb-3 mt-6 font-mono text-label uppercase tracking-[0.13em] text-brand-gray">{t.guide.otherTopics}</h2>
      <div className="flex flex-wrap gap-2">
        {guide.topics
          .filter((x) => x.id !== topic.id)
          .map((x) => (
            <Link
              key={x.id}
              href={`/guida/${x.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-white px-3 py-[6px] text-[12px] font-bold text-brand-near-black hover:border-primary-mid"
            >
              <span aria-hidden>{x.emoji}</span>
              {x.title}
            </Link>
          ))}
      </div>

      <GuideContact />
    </AppShell>
  );
}
