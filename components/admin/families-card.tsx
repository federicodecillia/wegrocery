"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminSetFamiliesEnabled } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";

// Impostazioni: whether members may invite each other into one account
// (app/famiglia).
export function FamiliesCard({ enabled }: { enabled: boolean }) {
  const s = t.admin.settings.families;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      const result = await adminSetFamiliesEnabled(!enabled);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <h3 className="text-[13px] font-bold text-brand-near-black">
        {s.title}: {enabled ? s.on : s.off}
      </h3>
      <p className="mt-1 text-[12px] text-brand-gray">{s.hint}</p>
      {enabled && <p className="mt-1 text-[12px] text-brand-gray">{s.offNote}</p>}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="mt-3 rounded-xl border border-brand-border px-4 py-2 text-[13px] font-bold text-brand-near-black disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : enabled ? s.disable : s.enable}
      </button>
    </section>
  );
}
