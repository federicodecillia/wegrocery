"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptTerms } from "@/lib/actions/profile";
import { t } from "@/lib/i18n";

// Shown by AppShell instead of the page while the person who signed in has
// not accepted the group's privacy notice and terms (lib/members/terms.ts).
// The texts stay on the group's site: only the links are here. No way past it
// but accepting or signing out; orders and payments are refused on the
// server meanwhile.
export function TermsPrompt({
  group,
  version,
  privacyUrl,
  termsUrl,
  signOut,
}: {
  group: string;
  version: string;
  privacyUrl: string | null;
  termsUrl: string | null;
  signOut: () => Promise<void>;
}) {
  const s = t.terms;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptTerms(version);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  const link = "inline-flex min-h-11 items-center text-[14px] font-semibold text-foreground underline";
  return (
    <section aria-labelledby="terms-prompt-title" className="mx-auto max-w-md rounded-card border border-border bg-card p-5 shadow-card">
      <h1 id="terms-prompt-title" className="text-[20px] font-bold text-foreground">
        {s.title}
      </h1>
      <p className="mt-2 text-[14px] text-secondary-foreground">{s.intro(group)}</p>
      <ul className="mt-3 space-y-1">
        {privacyUrl ? (
          <li>
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className={link}>
              {s.privacy}
            </a>
          </li>
        ) : null}
        {termsUrl ? (
          <li>
            <a href={termsUrl} target="_blank" rel="noopener noreferrer" className={link}>
              {s.terms}
            </a>
          </li>
        ) : null}
      </ul>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button variant="brand" block className="mt-4" disabled={isPending} onClick={handleAccept}>
        {isPending ? t.admin.common.saving : s.accept}
      </Button>
      <form action={signOut} className="mt-3 text-center">
        <button type="submit" className="min-h-11 text-[13px] font-semibold text-secondary-foreground underline">
          {s.signOut}
        </button>
      </form>
    </section>
  );
}
