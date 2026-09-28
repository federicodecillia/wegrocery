"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

export function CopyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
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
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-brand-gray">{label}</div>
        <div className={`break-all text-[14px] text-brand-near-black ${mono ? "font-mono" : "font-medium"}`}>
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-full border border-brand-border px-[12px] py-[5px] font-mono text-[11px] font-bold uppercase tracking-widest text-brand-near-black"
      >
        {copied ? t.topup.copied : t.topup.copy}
      </button>
    </div>
  );
}
