"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import { shouldRefreshOnReturn } from "@/lib/ui/refresh";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// Back in the foreground after a while (an installed app stays open for
// days), the page reloads its data: balance, cycle, notifications. Plus a
// line while the device is offline, so a save that fails is not a surprise.
export function AppRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        if (shouldRefreshOnReturn(pathname, Date.now() - hiddenAt)) router.refresh();
        hiddenAt = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pathname, router]);

  if (online) return null;
  return (
    <p role="status" className="mb-3 rounded-card border border-brand-border bg-white px-4 py-2.5 text-[14px] text-brand-near-black">
      <span aria-hidden>📡 </span>
      {t.common.offline}
    </p>
  );
}
