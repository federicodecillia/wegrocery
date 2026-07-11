import Link from "next/link";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { FaqAccordion } from "@/components/ui/faq-accordion";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { loadChangelog, splitInlineBold } from "@/lib/changelog";

export default async function GuidaPage() {
  const session = await requireUserSession();
  const role = getUserRole(session);

  // Pull the most recent released version (skip the [Unreleased] block) for
  // the teaser. The full history lives on /changelog. Italian is the default
  // for the in-app surface; users can switch language on the dedicated page.
  const versions = await loadChangelog("it");
  const latest = versions.find((v) => v.date !== null) ?? null;

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={session.user.memberId!}>
      <h1 className="mb-5 text-[20px] font-black tracking-[-0.03em] text-brand-near-black">
        {t.guide.title}
      </h1>

      {/* How-to steps */}
      <div className="mb-6 rounded-[18px] border border-brand-teal/20 bg-brand-teal-light p-[18px]">
        {t.guide.howToSteps.map((step, i) => (
          <div
            key={step.n}
            className={`flex gap-3 ${i < t.guide.howToSteps.length - 1 ? "mb-3" : ""}`}
          >
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-teal font-mono text-[11px] font-bold text-white">
              {step.n}
            </div>
            <p className="mt-[3px] text-[14px] leading-[1.5] text-brand-near-black">
              <strong>{step.title}</strong>
              <br />
              {step.body}
            </p>
          </div>
        ))}
      </div>

      {/* Novità — teaser della release più recente con link al changelog */}
      {latest && (
        <section className="mb-6 overflow-hidden rounded-[18px] border border-brand-orange-mid bg-brand-orange-light">
          <div className="flex items-baseline justify-between gap-2 border-b border-brand-orange-mid/40 px-[18px] py-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-brand-orange">
                {t.guide.newsTitle} · v{latest.version}
              </div>
              <h2 className="mt-0.5 text-[15px] font-black tracking-[-0.01em] text-brand-near-black">
                {t.guide.newsSubtitle}
              </h2>
            </div>
            {latest.date && (
              <span className="font-mono text-[10px] text-brand-gray">{latest.date}</span>
            )}
          </div>
          <div className="space-y-3 px-[18px] py-4">
            {latest.sections.slice(0, 2).map((s) => (
              <div key={s.heading}>
                <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wide text-brand-orange">
                  {s.heading}
                </div>
                <ul className="space-y-1.5">
                  {s.items.slice(0, 4).map((item, idx) => (
                    <li key={idx} className="text-[13px] leading-[1.45] text-brand-near-black">
                      {splitInlineBold(item.text).map((p, i) =>
                        p.bold ? (
                          <strong key={i} className="font-bold">
                            {p.value}
                          </strong>
                        ) : (
                          <span key={i}>{p.value}</span>
                        ),
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-brand-orange-mid/40 px-[18px] py-3 text-center">
            <Link
              href="/changelog"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-brand-orange hover:underline"
            >
              {t.guide.seeAllNews}
            </Link>
          </div>
        </section>
      )}

      {/* FAQ */}
      <h2 className="mb-[14px] text-[18px] font-extrabold tracking-[-0.02em] text-brand-near-black">
        {t.guide.faqTitle}
      </h2>
      <FaqAccordion faqs={t.guide.faq} />

      {/* Contact card */}
      <div className="mt-6 rounded-[18px] border border-brand-border bg-white p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-[10px] text-[32px]">{t.guide.contactEmoji}</div>
        <div className="mb-[6px] text-[15px] font-bold text-brand-near-black">{t.guide.contactHeading}</div>
        <p className="mb-4 text-[13px] text-brand-gray">
          {t.guide.contactIntro(brand.appName)}
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={`mailto:${brand.supportEmail}`}
            className="inline-flex items-center justify-center rounded-full bg-brand-orange px-[22px] py-[12px] text-sm font-bold text-white no-underline transition-transform active:scale-95"
          >
            {brand.supportEmail}
          </a>
          <a
            href={`mailto:${brand.techEmail}`}
            className="inline-flex items-center justify-center rounded-full bg-brand-near-black px-[22px] py-[12px] text-sm font-bold text-white no-underline transition-transform active:scale-95"
          >
            {brand.techEmail}
          </a>
        </div>
      </div>
    </AppShell>
  );
}
