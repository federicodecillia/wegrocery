"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { dismissWelcome } from "@/lib/actions/profile";
import { WELCOME_LINKS, welcomeSteps, type WelcomeMoney, type WelcomeStep } from "@/lib/guide/welcome";
import { t } from "@/lib/i18n";
import { isPhoneOrTablet } from "@/lib/pwa/install-hint";
import { parseWelcome, readWelcomeRaw, storeWelcome, subscribeNever } from "./welcome-storage";

// The first visit's short tour, at the top of Home: a few steps a newcomer
// pages through, closed for good with "Ho capito" or "Salta"
// (members.welcome_dismissed_at). The guide's "Rivedi il benvenuto" shows it
// again with ?benvenuto=1 (`reopened`). A link inside a step keeps the step
// in this tab, so the card resumes there and the other pages show a bar to
// come back (welcome-resume.tsx).

// A phone or tablet where the app is not opened from the home screen yet.
function readInstallable(): boolean {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone && isPhoneOrTablet(navigator.userAgent, navigator.maxTouchPoints);
}

// **bold** for button and page names, as in the guide. Not RichText: that
// one reads lib/changelog, a server module.
function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-bold">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function WelcomeCard({
  appName,
  money,
  families,
  hasGroupInfo,
  reopened,
}: {
  appName: string;
  money: WelcomeMoney;
  families: boolean;
  hasGroupInfo: boolean;
  reopened: boolean;
}) {
  const router = useRouter();
  const installable = useSyncExternalStore(subscribeNever, readInstallable, () => false);
  const stored = parseWelcome(useSyncExternalStore(subscribeNever, readWelcomeRaw, () => null));
  const steps = welcomeSteps({ money, families, install: installable });
  const [chosen, setChosen] = useState<WelcomeStep | null>(null);
  const [closed, setClosed] = useState(false);
  const [, startTransition] = useTransition();

  if (closed) return null;
  const wanted = chosen ?? stored?.step ?? steps[0];
  const current = Math.max(0, steps.indexOf(wanted));
  const step = steps[current];
  const text = t.welcome.steps[step];
  const body = step === "help" && hasGroupInfo ? t.welcome.helpBodyGroup : text.body;
  const last = current === steps.length - 1;

  function go(index: number) {
    const next = steps[index];
    setChosen(next);
    // Once the member has been following links, keep the bar in step.
    if (stored) storeWelcome({ step: next, n: index + 1, total: steps.length });
  }

  function close() {
    setClosed(true);
    storeWelcome(null);
    startTransition(async () => {
      await dismissWelcome();
      if (reopened) router.replace("/", { scroll: false });
    });
  }

  return (
    <section
      aria-label={t.welcome.title(appName)}
      className="mb-[14px] rounded-[20px] border-[1.5px] border-primary-mid bg-white p-[18px_20px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="font-mono text-label font-semibold uppercase tracking-[0.13em] text-primary-text">
          {t.welcome.title(appName)}
        </span>
        <button
          type="button"
          onClick={close}
          className="shrink-0 font-mono text-label font-bold uppercase tracking-widest text-muted hover:text-brand-near-black"
        >
          {t.welcome.skip}
        </button>
      </div>

      <div aria-live="polite">
        <h2 className="flex items-center gap-2 text-[17px] font-black tracking-[-0.01em] text-brand-near-black">
          <span aria-hidden className="text-[22px] leading-none">
            {text.emoji}
          </span>
          {text.title}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.5] text-brand-near-black">
          <Bold text={body} />
        </p>
        <Link
          href={WELCOME_LINKS[step]}
          onClick={() => storeWelcome({ step, n: current + 1, total: steps.length })}
          className="mt-2 inline-block text-[14px] font-bold text-primary-text hover:underline"
        >
          {text.link} →
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-[5px]">
          {steps.map((s, i) => (
            <span
              key={s}
              aria-hidden
              className={`h-[7px] rounded-full transition-all ${i === current ? "w-[18px] bg-primary" : "w-[7px] bg-brand-gray-light"}`}
            />
          ))}
          <span className="sr-only">{t.welcome.stepOf(current + 1, steps.length)}</span>
        </div>
        <div className="flex gap-2">
          {current > 0 && (
            <Button variant="outline" size="sm" onClick={() => go(current - 1)}>
              {t.welcome.back}
            </Button>
          )}
          {last ? (
            <Button variant="orange" size="sm" onClick={close}>
              {t.welcome.done}
            </Button>
          ) : (
            <Button variant="orange" size="sm" onClick={() => go(current + 1)}>
              {t.welcome.next}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
