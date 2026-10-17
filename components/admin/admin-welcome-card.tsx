"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { dismissAdminWelcome } from "@/lib/actions/admin-welcome";
import { ADMIN_WELCOME_LINKS, type AdminWelcomeStep } from "@/lib/admin/welcome";
import { t } from "@/lib/i18n";

// **bold** for button and page names, as in the guide.
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

// The admin's first visit to Admin: a few steps through the work of a cycle,
// closed for good with "Ho capito" or "Salta" (members.admin_welcome_dismissed_at).
// The admin guide's "Rivedi il benvenuto admin" shows it again (`reopened`).
export function AdminWelcomeCard({
  steps,
  done,
  reopened,
}: {
  steps: AdminWelcomeStep[];
  // Steps the group's rows show as done already (lib/admin/welcome.ts).
  done: readonly AdminWelcomeStep[];
  reopened: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [closed, setClosed] = useState(false);
  const [, startTransition] = useTransition();

  if (closed) return null;
  const step = steps[current];
  const text = t.adminWelcome.steps[step];
  const last = current === steps.length - 1;

  function close() {
    setClosed(true);
    startTransition(async () => {
      await dismissAdminWelcome();
      if (reopened) router.replace("/admin", { scroll: false });
    });
  }

  return (
    <section
      aria-label={t.adminWelcome.title}
      className="mb-4 rounded-card border-[1.5px] border-primary-mid bg-card px-5 py-4.5 shadow-card"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-label font-bold uppercase tracking-[0.08em] text-primary-text">{t.adminWelcome.title}</span>
        <button
          type="button"
          onClick={close}
          className="-my-3 min-h-11 shrink-0 font-mono text-label font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {t.welcome.skip}
        </button>
      </div>

      {current === 0 && <p className="mb-3 text-[13px] leading-[1.45] text-secondary-foreground">{t.adminWelcome.intro}</p>}

      <div aria-live="polite">
        <h2 className="flex flex-wrap items-center gap-2 text-[17px] font-black tracking-[-0.01em] text-foreground">
          <span aria-hidden className="text-[22px] leading-none">
            {text.emoji}
          </span>
          {text.title}
          {done.includes(step) && (
            <span className="rounded-full bg-accent-bg px-2 py-0.5 text-label font-semibold text-accent-text">
              <span aria-hidden>✓ </span>
              {t.welcome.stepDone}
            </span>
          )}
        </h2>
        <p className="mt-2 max-w-prose text-[14px] leading-[1.5] text-foreground">
          <Bold text={text.body} />
        </p>
        <Link href={ADMIN_WELCOME_LINKS[step]} className="mt-2 inline-flex min-h-11 items-center text-[14px] font-bold text-primary-text hover:underline">
          {text.link} →
        </Link>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.25">
          {steps.map((s, i) => (
            <span
              key={s}
              aria-hidden
              className={`h-[7px] rounded-full transition-all ${i === current ? "w-[18px] bg-primary" : done.includes(s) ? "w-[7px] bg-accent" : "w-[7px] bg-neutral"}`}
            />
          ))}
          <span className="sr-only">
            {t.welcome.stepOf(current + 1, steps.length)}
            {done.includes(step) ? `, ${t.welcome.stepDone}` : ""}
          </span>
        </div>
        <div className="flex gap-2">
          {current > 0 && (
            <Button variant="outline" size="sm" onClick={() => setCurrent(current - 1)}>
              {t.welcome.back}
            </Button>
          )}
          {last ? (
            <Button size="sm" onClick={close}>
              {t.welcome.done}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setCurrent(current + 1)}>
              {t.welcome.next}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
