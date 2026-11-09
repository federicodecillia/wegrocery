"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitMembershipRequest } from "@/lib/actions/signup";
import { t } from "@/lib/i18n";
import { REQUEST_LIMITS } from "@/lib/membership/signup";

// The request to join ('request' sign-up mode). After sending, the same
// message whatever happened: the page never tells who is a member.
export function SignupForm({
  termsNeeded,
  privacyUrl,
  termsUrl,
}: {
  termsNeeded: boolean;
  privacyUrl: string | null;
  termsUrl: string | null;
}) {
  const s = t.signup;
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await submitMembershipRequest({
        fullName: String(data.get("fullName") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        note: String(data.get("note") ?? ""),
        website: String(data.get("website") ?? ""),
        acceptTerms: data.get("acceptTerms") === "on",
      });
      if (result.ok) setSent(true);
      else setError(s.errors[result.field]);
    });
  }

  if (sent) {
    return (
      <p role="status" className="mt-5 rounded-xl border border-border bg-background p-3 text-sm text-foreground">
        {s.sent}
      </p>
    );
  }

  const label = "block text-sm font-medium text-foreground";
  const link = "font-semibold text-foreground underline";
  return (
    <form className="mt-5 space-y-3" onSubmit={onSubmit} noValidate>
      <div className="space-y-1">
        <label htmlFor="signup-name" className={label}>
          {s.name}
        </label>
        <Input id="signup-name" name="fullName" autoComplete="name" required maxLength={REQUEST_LIMITS.name} />
      </div>
      <div className="space-y-1">
        <label htmlFor="signup-email" className={label}>
          {s.email}
        </label>
        <Input id="signup-email" name="email" type="email" autoComplete="email" required maxLength={REQUEST_LIMITS.email} />
      </div>
      <div className="space-y-1">
        <label htmlFor="signup-phone" className={label}>
          {s.phone}
        </label>
        <Input id="signup-phone" name="phone" type="tel" autoComplete="tel" maxLength={REQUEST_LIMITS.phone} />
      </div>
      <div className="space-y-1">
        <label htmlFor="signup-note" className={label}>
          {s.note}
        </label>
        <Textarea id="signup-note" name="note" rows={3} maxLength={REQUEST_LIMITS.note} placeholder={s.notePlaceholder} />
      </div>
      {/* Honeypot: out of sight and out of the tab order; a bot fills it in. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="signup-website">Website</label>
        {/* design-guard: raw field (a honeypot nobody sees, not a field to style) */}
        <input id="signup-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {termsNeeded ? (
        <label className="flex min-h-11 items-start gap-3 text-sm text-foreground">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-5 shrink-0 accent-primary" />
          <span>
            {s.acceptPrefix}{" "}
            {privacyUrl ? (
              <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className={link}>
                {t.terms.privacy}
              </a>
            ) : null}
            {privacyUrl && termsUrl ? ` ${s.and} ` : null}
            {termsUrl ? (
              <a href={termsUrl} target="_blank" rel="noopener noreferrer" className={link}>
                {t.terms.terms}
              </a>
            ) : null}
          </span>
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="brand" block disabled={isPending}>
        {isPending ? s.sending : s.submit}
      </Button>
    </form>
  );
}
