import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { GuideSearch } from "@/components/guide/guide-search";
import { GuideTopicGrid } from "@/components/guide/topic-grid";
import { BackLink } from "@/components/ui/back-link";
import { requireUserSession } from "@/lib/auth/session";
import { adminGuideFor } from "@/lib/guide/admin";
import { ADMIN_GUIDE_SECTION, buildSearchIndex } from "@/lib/guide/search";
import { guideContext, visibleGuide } from "@/lib/guide/types";
import { t } from "@/lib/i18n";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import type { Metadata } from "next";

// The generic guide title: the tab title is sent before the role check
// answers, so it must not name the admin guide.
export const metadata: Metadata = { title: t.guide.title };

// The admin guide's index: search and topics, cards on app/guida/admin/[topic].
// Anyone but an active admin gets a 404, like an unknown page: the guide's
// content comes only from adminGuideFor, which checks the role itself.
export default async function AdminGuidePage() {
  const session = await requireUserSession();
  const content = adminGuideFor(session.user);
  if (!content) notFound();
  const guide = visibleGuide(content, guideContext(await getPaymentSettings()));
  const topicTitles = Object.fromEntries(guide.topics.map((x) => [`${ADMIN_GUIDE_SECTION}${x.id}`, x.title]));

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin memberId={session.user.memberId!} personId={session.user.personId}>
      <div className="mb-4">
        <BackLink href="/guida">{t.guide.backToGuide}</BackLink>
      </div>
      <h1 className="mb-1 text-title font-black text-foreground">{t.guide.adminTitle}</h1>
      <p className="mb-5 text-[14px] leading-snug text-secondary-foreground">{t.guide.adminIntro}</p>

      <GuideSearch
        index={buildSearchIndex(guide.articles, ADMIN_GUIDE_SECTION)}
        synonyms={guide.synonyms}
        stopwords={guide.stopwords}
        topicTitles={topicTitles}
        placeholder={t.guide.adminSearchPlaceholder}
      >
        <GuideTopicGrid guide={guide} section={ADMIN_GUIDE_SECTION} />
      </GuideSearch>
    </AppShell>
  );
}
