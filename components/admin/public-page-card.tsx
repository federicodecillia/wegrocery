"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { adminSetPublicPage } from "@/lib/actions/admin-settings";
import { GROUP_INFO_MAX, normalizeGroupInfo } from "@/lib/guide/group-info";
import { t } from "@/lib/i18n";

type Value = { enabled: boolean; productsPreview: boolean; indexable: boolean; intro: string };

// Impostazioni -> Gruppo -> Pagina pubblica (/gruppo, lib/public-page.ts):
// the switches and the presentation text, saved together.
export function PublicPageCard({
  saved,
}: {
  saved: { enabled: boolean; productsPreview: boolean; indexable: boolean; intro: string | null };
}) {
  const s = t.admin.settings.publicPage;
  const initial: Value = { ...saved, intro: saved.intro ?? "" };
  const [value, setValue] = useState<Value>(initial);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const tooLong = value.intro.length > GROUP_INFO_MAX;
  const unchanged =
    value.enabled === saved.enabled &&
    value.productsPreview === saved.productsPreview &&
    value.indexable === saved.indexable &&
    normalizeGroupInfo(value.intro) === saved.intro;

  function handleSave() {
    startTransition(async () => {
      const result = await adminSetPublicPage(value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  const option = "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5";
  const toggle = (key: "enabled" | "productsPreview" | "indexable", label: string, hint: string) => (
    <label className={option}>
      <input
        type="checkbox"
        checked={value[key]}
        disabled={isPending || (key !== "enabled" && !value.enabled)}
        onChange={(e) => setValue({ ...value, [key]: e.target.checked })}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span>
        <span className="block text-[13px] font-semibold text-foreground">{label}</span>
        <span className="block text-[12px] text-secondary-foreground">{hint}</span>
      </span>
    </label>
  );

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-bold text-foreground">{s.title}</h3>
      <p className="text-[12px] text-secondary-foreground">{s.hint}</p>
      {toggle("enabled", s.enabled, s.enabledHint)}
      {toggle("productsPreview", s.products, s.productsHint)}
      {toggle("indexable", s.indexable, s.indexableHint)}
      <div>
        <label htmlFor="public-intro" className="block text-[13px] font-semibold text-foreground">
          {s.intro}
        </label>
        <p className="text-[12px] text-secondary-foreground">{s.introHint}</p>
        <Textarea
          id="public-intro"
          value={value.intro}
          onChange={(e) => setValue({ ...value, intro: e.target.value })}
          rows={6}
          disabled={isPending}
          placeholder={s.introPlaceholder}
          className="mt-2 rounded-xl leading-[1.5] focus:border-primary"
        />
        <p className={`mt-1 text-right tabular-nums text-label ${tooLong ? "font-bold text-destructive" : "text-muted-foreground"}`}>
          {t.admin.settings.groupInfo.count(value.intro.length, GROUP_INFO_MAX)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || unchanged || tooLong}
          className="min-h-11 rounded-xl bg-inverse px-4 py-2 text-[13px] font-bold text-inverse-foreground disabled:opacity-60"
        >
          {isPending ? t.admin.common.saving : s.save}
        </button>
        {saved.enabled ? (
          <a href="/gruppo" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[13px] font-bold text-primary-text underline">
            {s.open}
          </a>
        ) : null}
      </div>
    </section>
  );
}
