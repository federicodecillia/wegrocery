"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { installHint } from "@/lib/pwa/install-hint";

// Invites a member on a phone to add the app to the home screen: the
// browser's own dialog where there is one (Android), the share-sheet steps on
// iPhone. Hidden once installed or dismissed; the dismissal stays in this
// browser only.

const DISMISSED_KEY = "wegrocery.install-dismissed";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

// One string, so the snapshot stays equal between renders.
function readBrowser(): string {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return JSON.stringify([navigator.userAgent, navigator.maxTouchPoints, standalone, readDismissed()]);
}

const subscribeNever = () => () => {};

export function InstallPrompt() {
  const browser = useSyncExternalStore(subscribeNever, readBrowser, () => null);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const onInstalled = () => setClosed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!browser || closed) return null;
  const [userAgent, maxTouchPoints, standalone, dismissed] = JSON.parse(browser) as [string, number, boolean, boolean];
  const hint = installHint({ userAgent, maxTouchPoints, standalone, dismissed, canPrompt: prompt !== null });
  if (!hint) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private mode: the banner simply comes back next time.
    }
    setClosed(true);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setClosed(true);
  }

  return (
    <section className="mt-[14px] rounded-card border border-accent/20 bg-accent-soft p-[14px_18px]">
      <h2 className="text-[15px] font-black tracking-[-0.01em] text-brand-near-black">{t.install.title}</h2>
      <p className="mt-1 text-[14px] leading-[1.45] text-brand-near-black">
        {hint === "prompt" ? t.install.promptBody : t.install.iosBody}
      </p>
      <div className="mt-3 flex gap-2">
        {hint === "prompt" && (
          <Button type="button" variant="accent" size="sm" onClick={install}>
            {t.install.installButton}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={dismiss}>
          {t.install.dismiss}
        </Button>
      </div>
    </section>
  );
}
