"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminClearGuideSearchMisses } from "@/lib/actions/admin-settings";
import { MISS_RETENTION_DAYS } from "@/lib/guide/search-misses";
import { t } from "@/lib/i18n";

// Impostazioni: what members searched in the guide without finding it
// (guide_search_misses), so the group can add it.
export function SearchMissesCard({ misses }: { misses: { query: string; count: number }[] }) {
  const s = t.admin.settings.searchMisses;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClear() {
    startTransition(async () => {
      const result = await adminClearGuideSearchMisses();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.cleared);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-bold text-foreground">{s.title}</h3>
      <p className="mt-1 text-[12px] text-secondary-foreground">{s.hint(MISS_RETENTION_DAYS)}</p>
      {misses.length === 0 ? (
        <p className="mt-3 text-[12px] text-muted-foreground">{s.empty}</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {misses.map((m) => (
              <li
                key={m.query}
                className="rounded-full border border-border bg-background px-3 py-1 text-[13px] text-foreground"
              >
                {m.query} <span className="tabular-nums text-label text-muted-foreground">{s.times(m.count)}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="mt-3 rounded-xl border border-border px-4 py-2 text-[13px] font-bold text-foreground disabled:opacity-60"
          >
            {s.clear}
          </button>
        </>
      )}
    </section>
  );
}
