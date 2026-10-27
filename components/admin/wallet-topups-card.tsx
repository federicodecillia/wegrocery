"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminSetWalletTopups } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";

// Impostazioni -> Borsellino: whether members may top up the wallet. Off, a
// line suggests the wallet balance in card payments to clear what is left,
// when card cycles exist and that switch is still off.
export function WalletTopupsCard({ enabled, suggestCardSettles }: { enabled: boolean; suggestCardSettles: boolean }) {
  const s = t.admin.settings.walletTopups;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      const result = await adminSetWalletTopups(!enabled);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  return (
    <section id="ricariche" className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-bold text-foreground">
        {s.title}: {enabled ? s.on : s.off}
      </h3>
      <p className="mt-1 text-[12px] text-secondary-foreground">{enabled ? s.hintOn : s.hintOff}</p>
      {!enabled && suggestCardSettles && <p className="mt-1 text-[12px] text-secondary-foreground">{s.suggest}</p>}
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
