import Link from "next/link";
import { brand } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import {
  loadChangelog,
  splitInlineBold,
  type ChangelogLanguage,
  type ChangelogVersion,
} from "@/lib/changelog";

type SearchParams = Promise<{ lang?: string }>;

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireUserSession();
  const role = getUserRole(session);

  const { lang: langParam } = await searchParams;
  const lang: ChangelogLanguage =
    langParam === "en" || langParam === "it"
      ? (langParam as ChangelogLanguage)
      : brand.locale;

  const versions = await loadChangelog(lang);
  const t = strings[lang];

  return (
    <AppShell
      email={session.user.email}
      isAdmin={role === "admin"}
      memberId={session.user.memberId!}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-black tracking-[-0.03em] text-brand-near-black">
            {t.title}
          </h1>
          <p className="mt-1 text-[13px] text-brand-gray">{t.subtitle}</p>
        </div>
        <LanguageToggle current={lang} />
      </div>

      <div className="space-y-5">
        {versions.map((v) => (
          <VersionBlock key={v.version} version={v} lang={lang} />
        ))}
      </div>

      <div className="mt-8 text-center text-[11px] text-brand-gray-light">
        <Link href="/guida" className="text-brand-teal underline-offset-2 hover:underline">
          ← {t.backToGuide}
        </Link>
      </div>
    </AppShell>
  );
}

// ── Section block ────────────────────────────────────────────────────────────

function VersionBlock({
  version,
  lang,
}: {
  version: ChangelogVersion;
  lang: ChangelogLanguage;
}) {
  const isUnreleased =
    version.version === "Unreleased" || version.version === "Non rilasciato";
  const t = strings[lang];

  return (
    <article className="overflow-hidden rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="border-b border-brand-border bg-brand-warm-white px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-black tracking-[-0.01em] text-brand-near-black">
            {isUnreleased ? t.unreleased : `v${version.version}`}
          </h2>
          {version.date && (
            <span className="font-mono text-[10px] uppercase tracking-wide text-brand-gray-light">
              {version.date}
            </span>
          )}
        </div>
        {version.tagline && (
          <p className="mt-1.5 text-[12px] italic leading-[1.45] text-brand-gray">
            {version.tagline}
          </p>
        )}
      </header>
      <div className="space-y-4 px-4 py-4">
        {version.sections.map((s) => (
          <section key={s.heading}>
            <h3
              className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${toneFor(s.heading)}`}
            >
              <span aria-hidden="true">{emojiFor(s.heading)}</span>
              {s.heading}
            </h3>
            <ul className="space-y-2">
              {s.items.map((item, idx) => (
                <li key={idx} className="text-[13px] leading-[1.5] text-brand-near-black">
                  <InlineMarkdown text={item.text} />
                  {item.subitems.length > 0 && (
                    <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[12px] text-brand-gray">
                      {item.subitems.map((sub, j) => (
                        <li key={j}>
                          <InlineMarkdown text={sub} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

// The category icon on the chip. Bullets carry their own topical emoji, so
// this one only has to say which kind of change the section groups.
function emojiFor(heading: string): string {
  const h = heading.toLowerCase();
  if (h === "added" || h === "aggiunte") return "✨";
  if (h === "fixed" || h === "risolto") return "🐛";
  if (h === "changed" || h === "modificato") return "🔄";
  if (h === "performance") return "⚡";
  if (h === "removed" || h === "rimosso") return "🗑️";
  if (h === "security" || h === "sicurezza") return "🔒";
  if (h === "documentation" || h === "documentazione") return "📚";
  return "•";
}

// Maps the section heading (in either language) to a tone class. Keeps the
// vocabulary in sync between languages without duplicating the mapping per
// language.
function toneFor(heading: string): string {
  const h = heading.toLowerCase();
  if (h === "added" || h === "aggiunte") return "bg-brand-teal-light text-brand-teal";
  if (h === "fixed" || h === "risolto") return "bg-brand-red-light text-brand-red";
  if (h === "changed" || h === "modificato")
    return "bg-brand-orange-light text-brand-orange";
  if (h === "performance") return "bg-[#e7ddff] text-[#5e2dc8]";
  if (h === "removed" || h === "rimosso") return "bg-black/[0.08] text-brand-gray";
  if (h === "security" || h === "sicurezza")
    return "bg-brand-red-light text-brand-red";
  if (h === "documentation" || h === "documentazione")
    return "bg-brand-teal-light text-brand-teal";
  return "bg-brand-warm-white text-brand-gray";
}

// Renders **bold** segments inline without pulling in a markdown library.
function InlineMarkdown({ text }: { text: string }) {
  const parts = splitInlineBold(text);
  return (
    <>
      {parts.map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-bold text-brand-near-black">
            {p.value}
          </strong>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}

// ── Language toggle ──────────────────────────────────────────────────────────

function LanguageToggle({ current }: { current: ChangelogLanguage }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-full border border-brand-border bg-white text-[10px] font-bold">
      <Link
        href="/changelog?lang=it"
        className={`px-2.5 py-1 ${current === "it" ? "bg-brand-near-black text-white" : "text-brand-gray"}`}
        aria-current={current === "it" ? "page" : undefined}
      >
        IT
      </Link>
      <Link
        href="/changelog?lang=en"
        className={`px-2.5 py-1 ${current === "en" ? "bg-brand-near-black text-white" : "text-brand-gray"}`}
        aria-current={current === "en" ? "page" : undefined}
      >
        EN
      </Link>
    </div>
  );
}

// ── Localised UI strings ─────────────────────────────────────────────────────

const strings: Record<ChangelogLanguage, { title: string; subtitle: string; unreleased: string; backToGuide: string }> = {
  it: {
    title: "Cosa è cambiato",
    subtitle: "Tutte le novità dell'app, dalla più recente alla più vecchia.",
    unreleased: "In arrivo",
    backToGuide: "Torna alla guida",
  },
  en: {
    title: "What's new",
    subtitle: "All app changes, most recent first.",
    unreleased: "Upcoming",
    backToGuide: "Back to the guide",
  },
};
