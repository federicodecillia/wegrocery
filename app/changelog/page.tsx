import Link from "next/link";
import { adminAccess } from "@/lib/auth/access";
import { brand } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { ChangelogView } from "@/components/changelog-view";
import { requireUserSession } from "@/lib/auth/session";
import { loadChangelog, readShowTechnical, type ChangelogLanguage } from "@/lib/changelog";
import { en } from "@/lib/i18n/en";
import { it } from "@/lib/i18n/it";

type SearchParams = Promise<{ lang?: string; tech?: string | string[] }>;

// What's new (Playbook 4.5 and 4.6): the FlyLabs Kit `changelog` module in the
// app shell. Changes for members by default, technical ones behind the switch.
export default async function ChangelogPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUserSession();

  const { lang: langParam, tech } = await searchParams;
  // The changelogs exist in Italian and English: a Spanish or French deploy reads the English one.
  const lang: ChangelogLanguage =
    langParam === "en" || langParam === "it" ? langParam : brand.locale === "it" ? "it" : "en";
  const versions = await loadChangelog(lang);
  const t = (lang === "it" ? it : en).changelog;

  return (
    <AppShell
      email={session.user.email}
      name={session.user.fullName}
      admin={adminAccess(session.user)}
      memberId={session.user.memberId!}
      personId={session.user.personId}
    >
      <ChangelogView versions={versions} lang={lang} showTechnical={readShowTechnical(tech)} />

      <div className="mt-8 text-center text-label text-muted-foreground">
        <Link href="/guida" className="text-accent-text underline-offset-2 hover:underline">
          ← {t.backToGuide}
        </Link>
      </div>
    </AppShell>
  );
}
