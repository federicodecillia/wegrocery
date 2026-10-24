"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminSetMemberNamePrompt } from "@/lib/actions/admin-settings";
import { NAME_PROMPT_MODES, type NamePromptMode } from "@/lib/members/name";
import { t } from "@/lib/i18n";

// Impostazioni: whether members still named after their address are asked
// for first and last name after signing in (components/name-prompt.tsx).
export function NamePromptCard({ mode: saved }: { mode: NamePromptMode }) {
  const s = t.admin.settings.namePrompt;
  // The choice shows at once; a refused save puts the stored one back.
  const [mode, setMode] = useState(saved);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function choose(next: NamePromptMode) {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await adminSetMemberNamePrompt(next);
      if (result.error) {
        setMode(previous);
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  return (
    <section id="nomi-soci" className="rounded-xl border border-border bg-card p-4">
      <fieldset disabled={isPending}>
        <legend className="text-[13px] font-bold text-foreground">{s.title}</legend>
        <p className="mt-1 text-[12px] text-secondary-foreground">{s.hint}</p>
        <div className="mt-3 space-y-2">
          {NAME_PROMPT_MODES.map((m) => (
            <label key={m} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5">
              <input
                type="radio"
                name="member-name-prompt"
                value={m}
                checked={mode === m}
                onChange={() => choose(m)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                <span className="block text-[13px] font-semibold text-foreground">{s.modes[m].label}</span>
                <span className="block text-[12px] text-secondary-foreground">{s.modes[m].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
