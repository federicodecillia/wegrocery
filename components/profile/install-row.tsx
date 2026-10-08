"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { installHint } from "@/lib/pwa/install-hint";

// The Profile page's lasting place for installing the app: same rules as the
// Home card (components/install-prompt.tsx), except that dismissing that card
// does not hide this row. Nothing on desktop or once installed.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function readBrowser(): string {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return JSON.stringify([navigator.userAgent, navigator.maxTouchPoints, standalone]);
}

const subscribeNever = () => () => {};

export function InstallRow() {
  const browser = useSyncExternalStore(subscribeNever, readBrowser, () => null);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!browser || installed) return null;
  const [userAgent, maxTouchPoints, standalone] = JSON.parse(browser) as [string, number, boolean];
  const hint = installHint({ userAgent, maxTouchPoints, standalone, dismissed: false, canPrompt: prompt !== null });
  if (!hint) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setInstalled(true);
  }

  return (
    <div className="px-4 py-[12px]">
      <div className="flex min-h-[28px] items-center gap-3">
        <div className="min-w-0 flex-1 text-[14px] font-bold text-brand-near-black">{t.install.title}</div>
        {hint === "prompt" ? (
          <Button type="button" variant="accent" size="sm" onClick={install}>
            {t.install.installButton}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {t.profile.howTo}
          </Button>
        )}
      </div>
      {hint === "ios" && open && <p className="mt-2 text-[12px] leading-snug text-brand-gray">{t.install.iosBody}</p>}
    </div>
  );
}
