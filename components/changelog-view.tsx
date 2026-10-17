import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import { en } from "@/lib/i18n/en";
import { it } from "@/lib/i18n/it";
import {
  splitInlineBold,
  visibleChangelog,
  type ChangelogLanguage,
  type ChangelogVersion,
  type VisibleVersion,
} from "@/lib/changelog";

// The /changelog page body (Playbook 4.5 and 4.6): changes for users by
// default, the technical ones behind a switch that is a link, so the page
// needs no client script. app/changelog/page.tsx handles session and shell
// and passes the parsed versions in.
//
// FlyLabs Kit registry module `changelog` 1.0, adapted to WeGrocery: strings
// in lib/i18n (both packs, since the page switches language on its own), the
// app's token names (Playbook 2.2 deviation), hand-drawn icons and emoji
// chips instead of lucide (Playbook 2.7 deviation).

/** The latest releases are shown open; older ones fold under version and tagline. */
const OPEN_VERSIONS = 3;

const STRINGS: Record<ChangelogLanguage, typeof it.changelog> = { it: it.changelog, en: en.changelog };

/** The page URL for a language and switch state; off leaves `tech` out. */
export function changelogHref(lang: ChangelogLanguage, showTechnical: boolean): string {
  return `/changelog?lang=${lang}${showTechnical ? "&tech=1" : ""}`;
}

export function ChangelogView({
  versions,
  lang,
  showTechnical,
}: {
  versions: ChangelogVersion[];
  lang: ChangelogLanguage;
  showTechnical: boolean;
}) {
  const t = STRINGS[lang];
  const visible = visibleChangelog(versions, showTechnical);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-black text-brand-near-black">{t.title}</h1>
          <p className="mt-1 text-[14px] text-muted">{t.subtitle}</p>
        </div>
        <LanguageToggle current={lang} showTechnical={showTechnical} />
      </div>

      <TechnicalSwitch lang={lang} on={showTechnical} />

      <div className="mt-4 space-y-5">
        {visible.slice(0, OPEN_VERSIONS).map((v) => (
          <VersionBlock key={v.version} version={v} lang={lang} />
        ))}
      </div>

      {visible.length > OPEN_VERSIONS && (
        <section aria-labelledby="older-versions" className="mt-8">
          <h2 id="older-versions" className="mb-3 font-mono text-label font-semibold uppercase tracking-wide text-muted">
            {t.older}
          </h2>
          <div className="space-y-2">
            {visible.slice(OPEN_VERSIONS).map((v) => (
              <VersionBlock key={v.version} version={v} lang={lang} collapsed />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// A link that looks like a switch: its words say what a tap does, so screen
// readers need nothing more, and the drawn switch is decoration.
function TechnicalSwitch({ lang, on }: { lang: ChangelogLanguage; on: boolean }) {
  const t = STRINGS[lang];
  return (
    <Link
      href={changelogHref(lang, !on)}
      scroll={false}
      className="inline-flex min-h-[var(--control-h)] items-center gap-2 rounded-md text-[14px] text-brand-near-black"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full border border-brand-border transition-colors ${on ? "bg-primary" : "bg-brand-gray-light"}`}
      >
        <span
          className={`absolute top-0.5 size-3.5 rounded-full bg-surface transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
      <UiIcon name="wrench" className="size-4 text-muted" />
      {on ? t.hideTechnical : t.showTechnical}
    </Link>
  );
}

function VersionBlock({
  version,
  lang,
  collapsed = false,
}: {
  version: VisibleVersion;
  lang: ChangelogLanguage;
  /** Folded under its version and tagline (a <details>, no script). */
  collapsed?: boolean;
}) {
  const t = STRINGS[lang];
  const isUnreleased = version.date === null;
  const Heading = collapsed ? "h3" : "h2";

  const head = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <Heading className="text-[15px] font-black tracking-[-0.01em] text-brand-near-black">
          {isUnreleased ? t.unreleased : `v${version.version}`}
        </Heading>
        <span className="flex shrink-0 items-baseline gap-2">
          {version.date && <span className="font-mono text-label uppercase tracking-wide text-muted">{version.date}</span>}
          {collapsed && (
            <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">
              ›
            </span>
          )}
        </span>
      </div>
      {version.tagline && <p className="mt-1.5 text-label italic leading-[1.45] text-muted">{version.tagline}</p>}
    </>
  );

  const body = (
    <div className="space-y-4 px-4 py-4">
      {version.sections.map((s) => (
        <Section key={s.heading} section={s} lang={lang} heading={collapsed ? "h4" : "h3"} />
      ))}
      {version.sections.length === 0 && <p className="text-[14px] text-muted">{t.onlyTechnical}</p>}
      {version.sections.length > 0 && version.hiddenTechnical > 0 && (
        <p className="text-label text-muted">{t.hiddenTechnical(version.hiddenTechnical)}</p>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <details className="group overflow-hidden rounded-card border border-brand-border bg-surface shadow-card">
        <summary className="cursor-pointer list-none bg-brand-warm-white px-4 py-3 hover:bg-tint/[0.02] group-open:border-b group-open:border-brand-border [&::-webkit-details-marker]:hidden">
          {head}
        </summary>
        {body}
      </details>
    );
  }

  return (
    <article className="overflow-hidden rounded-card border border-brand-border bg-surface shadow-card">
      <header className="border-b border-brand-border bg-brand-warm-white px-4 py-3">{head}</header>
      {body}
    </article>
  );
}

function Section({
  section,
  lang,
  heading: SectionHeading,
}: {
  section: VisibleVersion["sections"][number];
  lang: ChangelogLanguage;
  heading: "h3" | "h4";
}) {
  const t = STRINGS[lang];
  return (
    <section>
      <SectionHeading
        className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-label font-bold uppercase tracking-wide ${toneFor(section.heading)}`}
      >
        <span aria-hidden="true">{emojiFor(section.heading)}</span>
        {section.heading}
      </SectionHeading>
      <ul className="space-y-2">
        {section.items.map((item, idx) => (
          <li key={idx} className="text-[14px] leading-[1.5] text-brand-near-black">
            {item.audience === "technical" && (
              <span className="mr-1.5 inline-flex items-center gap-1 rounded border border-brand-border px-1.5 align-middle font-mono text-label uppercase tracking-wide text-muted">
                <UiIcon name="wrench" className="size-3" />
                {t.technicalBadge}
              </span>
            )}
            <InlineBold text={item.text} />
            {item.subitems.length > 0 && (
              <ul className="mt-1 ml-4 list-disc space-y-0.5 text-label text-muted">
                {item.subitems.map((sub, j) => (
                  <li key={j}>
                    <InlineBold text={sub} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// The section's kind, in either language. Colour never carries it alone
// (Playbook 2.5): the emoji and the word do. Bullets carry their own topical
// emoji, so this one only says which kind of change the section groups.
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

function toneFor(heading: string): string {
  const h = heading.toLowerCase();
  if (h === "added" || h === "aggiunte") return "bg-accent-soft text-accent-text";
  if (h === "fixed" || h === "risolto") return "bg-danger-soft text-danger-text";
  if (h === "changed" || h === "modificato") return "bg-primary-soft text-primary-text";
  if (h === "performance") return "bg-tint/[0.06] text-brand-near-black";
  if (h === "removed" || h === "rimosso") return "bg-tint/[0.08] text-brand-gray";
  if (h === "security" || h === "sicurezza") return "bg-danger-soft text-danger-text";
  if (h === "documentation" || h === "documentazione") return "bg-accent-soft text-accent-text";
  return "bg-brand-warm-white text-brand-gray";
}

function InlineBold({ text }: { text: string }) {
  return (
    <>
      {splitInlineBold(text).map((p, i) =>
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

function LanguageToggle({ current, showTechnical }: { current: ChangelogLanguage; showTechnical: boolean }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-full border border-brand-border bg-surface text-label font-bold">
      {(["it", "en"] as const).map((lang) => (
        <Link
          key={lang}
          href={changelogHref(lang, showTechnical)}
          aria-current={current === lang ? "page" : undefined}
          className={`inline-flex min-h-[var(--control-h)] min-w-[var(--control-h)] items-center justify-center px-2.5 ${current === lang ? "bg-inverse text-on-inverse" : "text-muted"}`}
        >
          {lang.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
