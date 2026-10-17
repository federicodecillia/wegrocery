"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

// `display` is what the member reads (e.g. an IBAN in groups of four); `value`
// is what lands in the clipboard. `code` is for a code-like value (an IBAN):
// it may break anywhere, with tabular figures (Inter, Playbook 2.1).
export function CopyField({
  label,
  value,
  display,
  code = false,
}: {
  label: string;
  value: string;
  display?: string;
  code?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (permissions, http): the value stays selectable.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-none">
      <div className="min-w-0">
        <div className="font-mono text-label uppercase tracking-[0.1em] text-secondary-foreground">{label}</div>
        <div className={`text-[14px] text-foreground ${code ? "break-all font-medium tabular-nums" : "break-words font-medium"}`}>
          {display ?? value}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="hit-44 shrink-0 rounded-full border border-border px-3 py-1.25 font-mono text-label font-bold uppercase tracking-widest text-foreground"
      >
        {copied ? t.topup.copied : t.topup.copy}
      </button>
    </div>
  );
}
