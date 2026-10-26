"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminSetCardSettlesWallet } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";

// Impostazioni: whether a card payment also settles the wallet (pays the debt,
// uses the credit first). Shown only where card cycles are possible.
export function CardSettlesWalletCard({ enabled }: { enabled: boolean }) {
  const s = t.admin.settings.cardSettlesWallet;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      const result = await adminSetCardSettlesWallet(!enabled);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  return (
    <section id="saldo-carta" className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-bold text-foreground">
        {s.title}: {enabled ? s.on : s.off}
      </h3>
      <p className="mt-1 text-[12px] text-secondary-foreground">{enabled ? s.hintOn : s.hintOff}</p>
      <p className="mt-1 text-[12px] text-secondary-foreground">{s.note}</p>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="mt-3 rounded-xl border border-border px-4 py-2 text-[13px] font-bold text-foreground disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : enabled ? s.disable : s.enable}
      </button>
    </section>
  );
}
