"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

type Status = "idle" | "sending" | "sent" | "rateLimited" | "failed" | "google" | "googleFailed";

// Posts straight to Better Auth's public endpoints (not a Server Action), so
// the requests go through its rate limit and origin check. Every address gets
// the same "check your inbox": the email itself says whether it is a member's.
export function LoginForm({ googleEnabled, next }: { googleEnabled: boolean; next: string }) {
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setStatus("sending");
    try {
      const response = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, callbackURL: next, errorCallbackURL: "/login?error=LinkInvalid" }),
      });
      setStatus(response.ok ? "sent" : response.status === 429 ? "rateLimited" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  async function onGoogle() {
    setStatus("google");
    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: next, errorCallbackURL: "/login" }),
      });
      const url = response.ok ? ((await response.json()) as { url?: unknown }).url : null;
      if (typeof url === "string") {
        window.location.assign(url);
        return;
      }
      setStatus(response.status === 429 ? "rateLimited" : "googleFailed");
    } catch {
      setStatus("googleFailed");
    }
  }

  const notice =
    status === "sent"
      ? t.login.sent
      : status === "rateLimited"
        ? t.login.rateLimited
        : status === "failed" || status === "googleFailed"
          ? t.login.failed
          : null;
  const busy = status === "sending" || status === "google";

  return (
    <div className="space-y-3">
      <form className="space-y-2" onSubmit={onSubmit}>
        <label htmlFor="email" className="block text-sm font-medium text-brand-near-black">
          {t.login.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={t.login.emailPlaceholder}
          className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-near-black focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button type="submit" variant="orange" block disabled={busy}>
          {status === "sending" ? t.login.sending : t.login.sendLink}
        </Button>
      </form>
      {googleEnabled && (
        <>
          <p className="text-center text-xs text-muted">{t.login.or}</p>
          <Button type="button" variant="outline" block onClick={onGoogle} disabled={busy}>
            {status === "google" ? t.login.googleRedirecting : t.login.googleLogin}
          </Button>
        </>
      )}
      {notice && (
        <p role="status" className="rounded-md border border-brand-border bg-brand-warm-white p-2 text-sm text-brand-near-black">
          {notice}
        </p>
      )}
    </div>
  );
}
