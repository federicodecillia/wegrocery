import { t } from "@/lib/i18n";

// The "?" next to a page title: opens the guide card that explains the page.
// A plain <a>, so the target card is highlighted (:target) on arrival. Its
// href is checked against the guide's topics and cards by lib/guide/guide.test.ts.
export function HelpLink({ href }: { href: `/guida/${string}` }) {
  return (
    <a
      href={href}
      aria-label={t.guide.helpLabel}
      title={t.guide.helpLabel}
      className="hit-44 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-border bg-white text-[14px] font-bold text-muted transition-colors hover:border-primary-mid hover:text-brand-near-black"
    >
      ?
    </a>
  );
}
