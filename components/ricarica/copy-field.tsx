"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

// `display` is what the member reads (e.g. an IBAN in groups of four); `value`
// is what lands in the clipboard.
export function CopyField({
  label,
  value,
  display,
  mono = false,
}: {
  label: string;
  value: string;
  display?: string;
  mono?: boolean;
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
    <div className="flex items-center justify-between gap-3 border-b border-brand-border py-[10px] last:border-none">
      <div className="min-w-0">
        <div className="font-mono text-label uppercase tracking-[0.1em] text-brand-gray">{label}</div>
        <div className={`text-[14px] text-brand-near-black ${mono ? "break-all font-mono" : "break-words font-medium"}`}>
          {display ?? value}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="hit-44 shrink-0 rounded-full border border-brand-border px-[12px] py-[5px] font-mono text-label font-bold uppercase tracking-widest text-brand-near-black"
      >
        {copied ? t.topup.copied : t.topup.copy}
      </button>
    </div>
  );
}
