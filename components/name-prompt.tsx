"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeMyName, postponeNamePrompt } from "@/lib/actions/profile";
import { t } from "@/lib/i18n";

// Shown by AppShell instead of the page to a member whose name is still the
// start of their address (lib/members/name.ts). After saving, the page they
// opened takes its place. "required": no "Più tardi", only signing out.
export function NamePrompt({
  currentName,
  required,
  signOut,
}: {
  currentName: string;
  required: boolean;
  signOut: () => Promise<void>;
}) {
  const s = t.namePrompt;
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await completeMyName(first, last);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleLater() {
    startTransition(async () => {
      const result = await postponeNamePrompt();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section aria-labelledby="name-prompt-title" className="mx-auto max-w-md rounded-card border border-border bg-card p-5 shadow-card">
      <h1 id="name-prompt-title" className="text-[20px] font-bold text-foreground">
        {s.title}
      </h1>
      <p className="mt-2 text-[14px] text-secondary-foreground">{s.why}</p>
      {currentName ? <p className="mt-1 text-[14px] text-secondary-foreground">{s.now(currentName)}</p> : null}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
        <div>
          <Label htmlFor="name-prompt-first">{s.first}</Label>
          <Input
            id="name-prompt-first"
            name="first"
            autoComplete="given-name"
            autoCapitalize="words"
            required
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="name-prompt-last">{s.last}</Label>
          <Input
            id="name-prompt-last"
            name="last"
            autoComplete="family-name"
            autoCapitalize="words"
            required
            value={last}
            onChange={(e) => setLast(e.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-[13px] font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="brand" block disabled={isPending || !first.trim() || !last.trim()}>
          {isPending ? t.admin.common.saving : s.save}
        </Button>
      </form>
      {required ? (
        <form action={signOut} className="mt-3 text-center">
          <button type="submit" className="min-h-11 text-[13px] font-semibold text-secondary-foreground underline">
            {s.signOut}
          </button>
        </form>
      ) : (
        <Button variant="ghost" block className="mt-2" disabled={isPending} onClick={handleLater}>
          {s.later}
        </Button>
      )}
    </section>
  );
}
