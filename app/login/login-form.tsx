"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

type Status =
  | "idle"
  | "sending"
  | "sent"
  | "rateLimited"
  | "failed"
  | "google"
  | "googleFailed"
  | "verifying"
  | "codeInvalid"
  | "codeTooManyAttempts";

// Posts straight to Better Auth's public endpoints (not a Server Action), so
// the requests go through its rate limit and origin check. Every address gets
// the same "check your inbox": the email itself says whether it is a member's.
// The email carries a link and a code: the code is typed here, for a phone
// whose mail app opens links in another browser (an installed app on iOS).
export function LoginForm({ googleEnabled, next }: { googleEnabled: boolean; next: string }) {
  const [status, setStatus] = useState<Status>("idle");
  // The address the link and code went to; null until a request went out.
  const [sentTo, setSentTo] = useState<string | null>(null);

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
      if (response.ok) setSentTo(email);
      setStatus(response.ok ? "sent" : response.status === 429 ? "rateLimited" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const otp = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\D/g, "");
    setStatus("verifying");
    try {
      const response = await fetch("/api/auth/sign-in/email-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: sentTo, otp }),
      });
      if (response.ok) {
        window.location.assign(next);
        return;
      }
      const failure: Partial<Record<number, Status>> = { 400: "codeInvalid", 403: "codeTooManyAttempts", 429: "rateLimited" };
      setStatus(failure[response.status] ?? "failed");
    } catch {
      setStatus("failed");
    }
  }

  function onChangeEmail() {
    setSentTo(null);
    setStatus("idle");
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

  const notices: Partial<Record<Status, string>> = {
    sent: t.login.sent,
    rateLimited: t.login.rateLimited,
    failed: t.login.failed,
    googleFailed: t.login.failed,
    codeInvalid: t.login.codeInvalid,
    codeTooManyAttempts: t.login.codeTooManyAttempts,
  };
  const notice = notices[status] ?? null;
  const busy = status === "sending" || status === "google" || status === "verifying";

  return (
    <div className="space-y-3">
      {/* Distinct keys: the two forms share a shape, and React would otherwise
          reuse the email <input> for the code, typed address included. */}
      {sentTo ? (
        <form key="code" className="space-y-2" onSubmit={onCode}>
          <label htmlFor="code" className="block text-sm font-medium text-brand-near-black">
            {t.login.codeLabel}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            placeholder="123456"
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-brand-near-black"
          />
          <Button type="submit" variant="orange" block disabled={busy}>
            {status === "verifying" ? t.login.codeVerifying : t.login.codeButton}
          </Button>
          <p className="text-center text-sm text-muted">
            {sentTo} ·{" "}
            <button type="button" onClick={onChangeEmail} className="text-primary-text underline">
              {t.login.changeEmail}
            </button>
          </p>
        </form>
      ) : (
        <form key="email" className="space-y-2" onSubmit={onSubmit}>
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
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-near-black"
          />
          <Button type="submit" variant="orange" block disabled={busy}>
            {status === "sending" ? t.login.sending : t.login.sendLink}
          </Button>
        </form>
      )}
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
