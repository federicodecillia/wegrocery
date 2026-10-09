"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminUpdateGroupInfo } from "@/lib/actions/admin-settings";
import { GROUP_INFO_MAX, GROUP_INFO_SLUG, normalizeGroupInfo } from "@/lib/guide/group-info";
import { t } from "@/lib/i18n";

// Impostazioni: "Il nostro gruppo", the group's own text at the top of the
// members' guide (/guida).
export function GroupInfoCard({ initial }: { initial: string | null }) {
  const s = t.admin.settings.groupInfo;
  const [value, setValue] = useState(initial ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const unchanged = normalizeGroupInfo(value) === initial;
  const tooLong = value.length > GROUP_INFO_MAX;

  function handleSave() {
    startTransition(async () => {
      const result = await adminUpdateGroupInfo(value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(normalizeGroupInfo(value) === null ? s.removed : s.saved);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <h3 className="text-[13px] font-bold text-brand-near-black">{s.title}</h3>
      <p className="mt-1 text-[12px] text-brand-gray">{s.hint}</p>
      <label htmlFor="group-info" className="sr-only">
        {s.title}
      </label>
      <textarea
        id="group-info"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        placeholder={s.placeholder}
        className="mt-3 w-full rounded-xl border border-brand-border px-3 py-2 text-[13px] leading-[1.5] text-brand-near-black placeholder:text-muted focus:border-primary"
      />
      <div className="mt-1 flex items-start justify-between gap-3">
        <p className="text-[12px] text-brand-gray">{value.trim() ? s.format : s.empty}</p>
        <span className={`shrink-0 font-mono text-label ${tooLong ? "font-bold text-brand-red" : "text-muted"}`}>
          {s.count(value.length, GROUP_INFO_MAX)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || unchanged || tooLong}
          className="rounded-xl bg-brand-near-black px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {isPending ? t.admin.common.saving : s.save}
        </button>
        {initial && (
          <a href={`/guida#${GROUP_INFO_SLUG}`} className="text-[12px] font-bold text-primary-text hover:underline">
            {s.preview}
          </a>
        )}
      </div>
    </section>
  );
}
