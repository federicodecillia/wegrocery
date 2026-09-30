"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

// The demo's two profiles and the local developer login: a POST to their
// Better Auth endpoint, then home.
export function ShortcutButtons({ demo, dev }: { demo: boolean; dev: boolean }) {
  const [busy, setBusy] = useState(false);
  async function go(path: string, body: unknown) {
    setBusy(true);
    const response = await fetch(`/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) window.location.assign("/");
    else setBusy(false);
  }
  return (
    <div className="space-y-3">
      {demo && (
        <>
          <Button type="button" variant="teal" block disabled={busy} onClick={() => go("/demo/sign-in", { profile: "user" })}>
            {t.login.memberLogin}
          </Button>
          <Button type="button" variant="orange" block disabled={busy} onClick={() => go("/demo/sign-in", { profile: "admin" })}>
            {t.login.adminLogin}
          </Button>
        </>
      )}
      {dev && (
        <Button type="button" variant="outline" block disabled={busy} onClick={() => go("/dev/sign-in", {})}>
          {t.login.devLogin}
        </Button>
      )}
    </div>
  );
}
