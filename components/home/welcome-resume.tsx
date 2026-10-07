"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { dismissWelcome } from "@/lib/actions/profile";
import { WELCOME_QUERY } from "@/lib/guide/welcome";
import { t } from "@/lib/i18n";
import { parseWelcome, readWelcomeRaw, storeWelcome, subscribeNever } from "./welcome-storage";

// On every page but Home: a slim bar while the member is following a link
// from the welcome card, to go back to the step they left (AppShell).
export function WelcomeResume() {
  const pathname = usePathname();
  // usePathname re-renders on navigation, so the snapshot is read again.
  const stored = parseWelcome(useSyncExternalStore(subscribeNever, readWelcomeRaw, () => null));
  const [closed, setClosed] = useState(false);
  const [, startTransition] = useTransition();

  if (!stored || closed || pathname === "/") return null;

  function close() {
    setClosed(true);
    storeWelcome(null);
    startTransition(async () => {
      await dismissWelcome();
    });
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-[14px] border border-primary-mid bg-primary-soft px-4 py-[10px]">
      <span className="text-[13px] font-semibold text-brand-near-black">
        <span aria-hidden>👋 </span>
        {t.welcome.resume}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <Link href={`/?${WELCOME_QUERY}=1`} className="text-[13px] font-bold text-primary-text hover:underline">
          {t.welcome.resumeLink(stored.n, stored.total)}
        </Link>
        <button type="button" onClick={close} aria-label={t.welcome.close} className="text-muted hover:text-brand-near-black">
          ✕
        </button>
      </span>
    </div>
  );
}
